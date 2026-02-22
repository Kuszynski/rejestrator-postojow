import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export async function GET() {
    try {
        const projectRoot = path.join(process.cwd(), '..');

        // AUTO-EXPIRY: Usuń pliki CSV starsze niż 4 godziny przy każdym wejściu na stronę
        // + Usuń pliki tymczasowe (sensor_*, dane_*) które tworzony jest przez Pythona ale nie są potrzebne do dashboardu
        // + Bezpiecznik: pliki > 15MB są usuwane natychmiast (zawiesza przeglądarkę)
        const EXPIRY_MS = 1 * 60 * 60 * 1000; // 1 godzina (zredukowane z 4h dla świeżości)
        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
        const now = Date.now();
        try {
            const allCsvFiles = fs.readdirSync(projectRoot).filter(f => f.endsWith('.csv'));
            for (const csvFile of allCsvFiles) {
                const filePath = path.join(projectRoot, csvFile);
                const stat = fs.statSync(filePath);
                const isIntermediate = csvFile.startsWith('sensor_') || csvFile.startsWith('dane_') || csvFile.startsWith('dane_hala_') || csvFile.startsWith('dane_lozysko_');
                const isExpired = now - stat.mtime.getTime() > EXPIRY_MS;
                const isOversized = stat.size > MAX_FILE_SIZE;
                // Bezpiecznik: pliki tymczasowe usuwamy tylko jeśli są starsze niż 5 minut (pozwala dokończyć analizę)
                const isOldIntermediate = isIntermediate && (now - stat.mtime.getTime() > 5 * 60 * 1000);

                if (isOldIntermediate || isExpired || isOversized) {
                    fs.unlinkSync(filePath);
                    const reason = isOldIntermediate ? 'stary plik tymczasowy' : isOversized ? `za duży (${Math.round(stat.size / 1024 / 1024)}MB)` : 'wygasł';
                    console.log(`[AUTO-CLEANUP] Usunięto: ${csvFile} (${reason})`);
                }
            }
        } catch (cleanupErr) {
            console.error('[AUTO-CLEANUP] Błąd:', cleanupErr);
        }

        // Szukaj plików raport_sensor_* (stare) oraz raport_batch_* (nowe)
        const files = fs.readdirSync(projectRoot);
        let sensorFiles = files.filter(f => (f.startsWith('raport_sensor_') || f.startsWith('raport_batch_')) && f.endsWith('.csv'));

        // Optymalizacja: Zostaw tylko 3 najnowsze grupy (zapobiega zapychaniu RAMu przeglądarki starymi testami)
        const fileStats = sensorFiles.map(f => ({ file: f, time: fs.statSync(path.join(projectRoot, f)).mtime.getTime() }));
        fileStats.sort((a, b) => b.time - a.time);

        const recentGroups = new Set<string>();
        const filteredFiles = [];

        for (const fsInfo of fileStats) {
            let groupId = 'Standard';
            if (fsInfo.file.startsWith('raport_batch_')) {
                // Usuwamy 'raport_batch_' i '.csv', potem dzielimy po PIERWSZYM '_'
                const base = fsInfo.file.replace('raport_batch_', '').replace('.csv', '');
                const firstUnderscore = base.indexOf('_');
                groupId = firstUnderscore !== -1 ? base.substring(0, firstUnderscore) : base;
            } else {
                groupId = 'Standard';
            }

            if (recentGroups.size < 3 || recentGroups.has(groupId)) {
                recentGroups.add(groupId);
                filteredFiles.push(fsInfo.file);
            }
        }
        sensorFiles = filteredFiles;
        if (sensorFiles.length === 0) {
            console.log(`[API DATA] Nie znaleziono żadnych plików raportów w ${projectRoot}`);
        }

        // Struktura: { "BATCH_ID": { sensors: { "SN1": [], "SN2": [] }, aggregateState: "MONITORING" } }
        const byGroup: Record<string, { sensors: Record<string, any[]>, aggregateState: string }> = {};
        const alertFeed: any[] = [];

        for (const file of sensorFiles) {
            let groupId = 'Standard';
            let shortSn = 'UNKNOWN';

            if (file.startsWith('raport_batch_')) {
                // Format: raport_batch_BATCHID_SN.csv
                // BATCHID może mieć myślniki, SN może mieć podkreślenia
                const base = file.replace('raport_batch_', '').replace('.csv', '');
                const firstUnderscore = base.indexOf('_');
                if (firstUnderscore !== -1) {
                    groupId = base.substring(0, firstUnderscore);
                    shortSn = base.substring(firstUnderscore + 1);
                } else {
                    groupId = base;
                    shortSn = 'UNKNOWN';
                }
            } else {
                // Stary format pojedynczego sensora
                shortSn = file.replace('raport_sensor_', '').replace('.csv', '');
            }

            const filePath = path.join(projectRoot, file);
            const cachePath = filePath + '.cache.json';
            let sampledRows = [];
            let score = 0;

            // --- CACHE CHECK ---
            if (fs.existsSync(cachePath)) {
                const csvStat = fs.statSync(filePath);
                const cacheStat = fs.statSync(cachePath);

                if (cacheStat.mtime > csvStat.mtime) {
                    try {
                        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
                        // Walidacja: jeśli cache jest za duży (stary błąd), wymuś re-sampling
                        if (cached.data && cached.data.length <= 500) {
                            sampledRows = cached.data;
                            score = cached.score || 0;
                        } else {
                            console.log(`[CACHE VALIDATION] Cache dla ${file} jest za duży (${cached.data?.length}), wymuszam re-sampling.`);
                        }
                    } catch (e) {
                        console.error(`[CACHE ERROR] Failed reading cache for ${file}:`, e);
                    }
                }
            }

            if (sampledRows.length === 0) {
                // --- PARSE CSV (Cache Miss) ---
                const content = fs.readFileSync(filePath, 'utf-8');
                const parsed = Papa.parse(content, {
                    header: true, skipEmptyLines: true, dynamicTyping: true, delimiter: ';'
                });

                if (parsed.errors.length > 0) console.error(`Feil ved parsing av ${file}:`, parsed.errors);
                const rows = (parsed.data as any[]).filter(r => r.timestamp);
                if (rows.length === 0) {
                    console.error(`[API DATA] Plik ${file} nie zawiera żadnych rekordów z timestampem.`);
                    continue;
                }
                rows.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                // FILTRUJ KOLUMNY: Zostaw tylko to co potrzebne na dashboardzie
                const filteredRows = rows.map(r => ({
                    timestamp: r.timestamp,
                    temp_mean: r.temp_mean,
                    vib_rms: r.vib_rms,
                    FINAL_VERDICT: r.FINAL_VERDICT,
                    temp_gradient_final: r.temp_gradient_final,
                    alarm_source: r.alarm_source
                }));

                const MAX_POINTS = 300;
                if (filteredRows.length <= MAX_POINTS) {
                    sampledRows = filteredRows;
                } else {
                    const step = Math.ceil(filteredRows.length / MAX_POINTS);
                    sampledRows = filteredRows.filter((row: any, i: number) => {
                        const verdict = String(row.FINAL_VERDICT || 'IDLE');
                        if (verdict !== 'IDLE' && verdict !== 'MONITORING') return true;
                        return i % step === 0;
                    });
                }

                // Ostatni werdykt decyduje o wyniku (score)
                if (rows.length > 0) {
                    const lastVerdict = String(rows[rows.length - 1].FINAL_VERDICT || 'IDLE');
                    if (lastVerdict.includes('BRANN') || lastVerdict.includes('POŻAR') || lastVerdict.includes('KRITISK') || lastVerdict.includes('KRYTYCZNA')) score = 3;
                    else if (lastVerdict.includes('SERVICE') || lastVerdict.includes('SERWIS')) score = 2;
                    else if (lastVerdict.includes('MONITORING')) score = 1;
                }

                // SAVE TO CACHE
                try {
                    fs.writeFileSync(cachePath, JSON.stringify({ data: sampledRows, score }));
                    // console.log(`[CACHE SAVE] Saved: ${file}`);
                } catch (e) {
                    console.error(`[CACHE ERROR] Failed saving cache for ${file}:`, e);
                }
            }

            if (!byGroup[groupId]) {
                byGroup[groupId] = { sensors: {}, aggregateState: 'INAKTIV' };
            }
            byGroup[groupId].sensors[shortSn] = sampledRows;

            // Zbieranie alertów i stanu grupy
            for (const row of sampledRows) {
                const verdict = String(row.FINAL_VERDICT || 'IDLE');
                if (verdict !== 'IDLE' && verdict !== 'MONITORING' && !verdict.includes('MONITORING')) {
                    alertFeed.push({
                        timestamp: row.timestamp,
                        FINAL_VERDICT: verdict,
                        temp_mean: row.temp_mean,
                        vib_rms: row.vib_rms,
                        temp_gradient_final: row.temp_gradient_final,
                        alarm_source: row.alarm_source,
                        shortSn,
                        groupId
                    });
                }
            }

            // Ustal stan grupy na podstawie score
            let currentGroupScore = 0;
            const gs = byGroup[groupId].aggregateState;
            if (gs === 'BRANN' || gs === 'POŻAR') currentGroupScore = 3;
            else if (gs === 'SERVICE' || gs === 'SERWIS') currentGroupScore = 2;
            else if (gs === 'MONITORING') currentGroupScore = 1;

            if (score > currentGroupScore) {
                if (score === 3) byGroup[groupId].aggregateState = 'BRANN';
                else if (score === 2) byGroup[groupId].aggregateState = 'SERVICE';
                else if (score === 1) byGroup[groupId].aggregateState = 'MONITORING';
            }
        }

        // Now we just extract the LATEST state for each sensor to send to the frontend
        const latestStateByGroup: Record<string, { sensors: Record<string, any>, aggregateState: string }> = {};

        for (const gId of Object.keys(byGroup)) {
            latestStateByGroup[gId] = { sensors: {}, aggregateState: byGroup[gId].aggregateState };
            for (const sn of Object.keys(byGroup[gId].sensors)) {
                const rows = byGroup[gId].sensors[sn];
                if (rows && rows.length > 0) {
                    latestStateByGroup[gId].sensors[sn] = rows[rows.length - 1];
                }
            }
        }

        // --- PRE-CALCULATE COMBINED DATA IN BACKEND (Fixes browser hang) ---
        // Generujemy zsynchronizowaną czasowo tablicę dla 'KOMBINERT OVERSIKT'
        // USUNIĘTE: nie pakujemy już historii punktów do combinedData

        // Sortowanie alertów
        alertFeed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Sortowanie grup od najnowszych
        const orderedGroups = Object.keys(byGroup).sort((a, b) => {
            const getNewestTs = (g: string) => {
                const dates = Object.values(byGroup[g].sensors).flat()
                    .map((r: any) => new Date(r.timestamp).getTime())
                    .filter(t => !isNaN(t));
                return dates.length > 0 ? Math.max(...dates) : 0;
            };
            return getNewestTs(b) - getNewestTs(a);
        });

        console.log(`[API DATA] Zwracam ${orderedGroups.length} grup: ${orderedGroups.join(', ')} (BEZ HISTORII WYKRESÓW)`);

        return NextResponse.json({
            groups: latestStateByGroup, // WYSYŁAMY TYLKO OSTATNI STAN
            orderedGroups: orderedGroups,
            alerts: alertFeed.slice(0, 50) // Zmniejszony limit alertów do najnowszych 50
        });

    } catch (error: any) {
        console.error('Feil ved lasting av CSV:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
