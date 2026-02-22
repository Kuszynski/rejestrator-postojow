import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';

const NEURON_BASE_URL = "https://api.neuron.no";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { apiKey, systemId, startTime, endTime, selectedSensors } = body;

        if (!apiKey || !systemId || !startTime || !endTime || !selectedSensors || selectedSensors.length === 0) {
            return NextResponse.json({ error: "Mangler obligatoriske felt eller ingen sensorer valgt" }, { status: 400 });
        }

        const startTs = new Date(startTime).getTime();
        const endTs = new Date(endTime).getTime();

        const projectRoot = path.join(process.cwd(), '..');
        const batchId = 'API-' + crypto.randomBytes(4).toString('hex').toUpperCase();

        // --- CLEANUP: "Clean Slate" - usuń wszystkie stare raporty i cache przed nowym pobraniem ---
        try {
            const oldFiles = fs.readdirSync(projectRoot).filter(f =>
                (f.endsWith('.csv') && (f.startsWith('raport_') || f.startsWith('sensor_api_') || f.startsWith('dane_hala_api_'))) ||
                (f.endsWith('.cache.json'))
            );
            for (const oldFile of oldFiles) {
                fs.unlinkSync(path.join(projectRoot, oldFile));
            }
            console.log(`[API FETCH] Clean Slate: Usunięto ${oldFiles.length} starych plików raportów/cache.`);
        } catch (cleanupErr) {
            console.error('[API FETCH] Błąd podczas czyszczenia Clean Slate:', cleanupErr);
        }
        // --------------------------------------------------------------------------

        const savedFiles: string[] = [];
        const debugInfo: string[] = []; // Zbiera info z każdego sensora na potrzeby debugowania

        // Pobierz próbki dla każdego sensora (równolegle)
        const sensorPromises = selectedSensors.map(async (sTarget: any) => {
            let samples: any[] = [];
            try {
                // Spróbuj wielu endpointów
                const endpoints = [
                    `https://api.neuronsensors.app/v2/systems/${systemId}/devices/${sTarget.sn}/samples?from=${startTs}&to=${endTs}&limit=10000`,
                    `https://api.neuronsensors.app/v1/systems/${systemId}/devices/${sTarget.sn}/samples?from=${startTs}&to=${endTs}&limit=10000`
                ];

                for (const url of endpoints) {
                    try {
                        const epName = url.replace(/https:\/\/api\.neuronsensors\.app/, '').split('?')[0];
                        const controller = new AbortController();
                        const timeout = setTimeout(() => controller.abort(), 45000); // 45s timeout for large ranges
                        const res = await fetch(url, { headers: { "ApiKey": apiKey as string }, signal: controller.signal });
                        clearTimeout(timeout);

                        if (!res.ok) {
                            debugInfo.push(`SN:${sTarget.sn} ${epName} → HTTP ${res.status}`);
                            continue;
                        }

                        const rawJson = await res.json();
                        let extracted: any[] = [];

                        if (Array.isArray(rawJson)) extracted = rawJson;
                        else if (rawJson && Array.isArray(rawJson.items)) extracted = rawJson.items;
                        else if (rawJson && typeof rawJson === 'object') {
                            Object.values(rawJson).find(v => Array.isArray(v) && (extracted = v));
                        }

                        if (extracted.length > 0) {
                            // Sprawdź zakres
                            const filtered = extracted.filter(s => {
                                const ts = new Date(s.timestamp || s.time).getTime();
                                return ts >= (startTs - 60000) && ts <= (endTs + 60000);
                            });

                            if (filtered.length > 0) {
                                samples = filtered;
                                console.log(`[API FETCH] SN: ${sTarget.sn} → Found ${samples.length} valid samples.`);
                            } else {
                                debugInfo.push(`SN:${sTarget.sn} ${epName} → Got ${extracted.length}, 0 in range.`);
                            }
                        } else {
                            debugInfo.push(`SN:${sTarget.sn} ${epName} → OK, but 0 samples.`);
                        }
                        break;
                    } catch (e: any) {
                        debugInfo.push(`SN:${sTarget.sn} ERR: ${e.name === 'AbortError' ? 'TIMEOUT (45s)' : e.message}`);
                    }
                }

                if (samples.length > 0) {
                    // Sortuj i czyść
                    samples.sort((a, b) => new Date(a.timestamp || a.time).getTime() - new Date(b.timestamp || b.time).getTime());
                    const seen = new Set();
                    const finalData = samples.filter(d => {
                        const key = `${d.timestamp || d.time}_${d.value}`;
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });

                    let csvContent = "sn;time;unit;value;timestamp\n";
                    for (const sample of finalData) {
                        const ts = sample.timestamp || sample.time;
                        if (!ts) continue;
                        const isoStr = new Date(ts).toISOString();
                        const u = sample.unit || (sTarget.is_hall ? 'C' : 'g');
                        csvContent += `${sTarget.sn};${isoStr};${u};${sample.value};${isoStr}\n`;
                    }

                    const cleanAlias = sTarget.alias.replace(/[^a-zA-Z0-9]/g, '');
                    const safeName = sTarget.is_hall ? `dane_hala_api_${cleanAlias}_${sTarget.sn}.csv` : `sensor_api_${cleanAlias}_${sTarget.sn}.csv`;
                    fs.writeFileSync(path.join(projectRoot, safeName), csvContent);
                    savedFiles.push(safeName);
                    console.log(`[API FETCH] Saved CSV for sensor SN: ${sTarget.sn} to ${safeName}.`);
                } else {
                    console.log(`[API FETCH] SN: ${sTarget.sn} → No data found in the requested range.`);
                }
            } catch (e: any) {
                console.error(`[API FETCH ERROR] SN:${sTarget.sn}:`, e);
                debugInfo.push(`SN:${sTarget.sn} GLOBAL ERR: ${e.message}`);
            }
        });

        await Promise.all(sensorPromises);

        console.log(`[API FETCH] Finished processing all selected sensors. Total files saved: ${savedFiles.length}.`);
        if (savedFiles.length === 0) {
            const debugStr = debugInfo.length > 0 ? ` Debug: ${debugInfo.slice(0, 3).join(' | ')}` : '';
            return NextResponse.json({ error: `Kunne ikke hente noe gyldig data.${debugStr}` }, { status: 400 });
        }

        // Uruchom pythona na zapisanej paczce API
        console.log(`[API FETCH] Starter python: analyze_batch.py ${batchId} ${savedFiles.join(' ')}`);
        const pythonLogs: string[] = [];
        await new Promise<void>((resolve, reject) => {
            // Na Windows 'shell: true' pomaga w znajdowaniu komendy 'python'
            const args = ['analyze_batch.py', batchId, ...savedFiles];
            const pythonProcess = spawn('python', args, { cwd: projectRoot, shell: true });

            pythonProcess.stdout.on('data', (data) => {
                const msg = data.toString().trim();
                console.log(`[PYTHON OUT] ${msg}`);
                pythonLogs.push(msg);
            });

            pythonProcess.stderr.on('data', (data) => {
                const msg = data.toString().trim();
                console.error(`[PYTHON ERR] ${msg}`);
                pythonLogs.push("ERR: " + msg);
            });

            pythonProcess.on('close', (code) => {
                console.log(`[PYTHON METADATA] Exited with code ${code}`);
                // List files for debugging
                const allFiles = fs.readdirSync(projectRoot);
                const createdReports = allFiles.filter(f => f.startsWith(`raport_batch_${batchId}`));

                if (code === 0) {
                    if (createdReports.length === 0) {
                        const csvFiles = allFiles.filter(f => f.startsWith('sensor_api_') || f.startsWith('dane_hala_api_'));
                        console.error(`[API FETCH] Python OK, ale BRAK raportów dla ${batchId}. Pliki w folderze: ${csvFiles.join(', ')}`);
                        reject(new Error(`Analiza zakończona kodem 0, ale brak plików raportu dla ${batchId}. Logi: ${pythonLogs.slice(-10).join(' | ')}`));
                    } else {
                        console.log(`[API FETCH] Suksess for batch ${batchId}. Utworzono ${createdReports.length} raportów.`);
                        resolve();
                    }
                }
                else reject(new Error(`Analiza Python nie powiodła się (kod ${code}). Logi: ${pythonLogs.slice(-10).join(' | ')}`));
            });
            pythonProcess.on('error', (err) => {
                console.error(`[PYTHON SPAWN ERROR] ${err.message}`);
                reject(new Error(`Nie udało się uruchomić Pythona: ${err.message}`));
            });
        });

        console.log(`[API FETCH] Suksess for batch ${batchId}`);
        return NextResponse.json({
            message: 'Vellykket API-import og analyse',
            batchId: batchId,
            sensorsProcessed: savedFiles.length,
            debug: debugInfo.slice(-10) // Wyślij ostatnie 10 wpisów debugowania
        });

    } catch (error: any) {
        console.error(`[API FETCH EXCEPTION] ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
