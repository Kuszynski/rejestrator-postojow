import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const NEURON_BASE_URL = "https://api.neuronics.no"; // Uzupełnione na domyślny URL API Neuron.

// 1. Pobieranie listy urządzeń i filtrowanie
async function fetchAndFilterDevices(apiKey: string, systemId: string) {
    const url = `${NEURON_BASE_URL}/v2/systems/${systemId}/devices`; // Adjust version if needed, typically v2
    const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${apiKey}` }, // Or "ApiKey": apiKey depending on strict Neuron specs. Assuming standard Bearer or token.
        // User's python used: {"ApiKey": api_key}
    });

    if (!res.ok) {
        throw new Error(`Feil ved henting av deviceliste: ${res.statusText}`);
    }

    const data = await res.json();
    const urzadzenia = data.items || data; // Handle pagination wrapper if exists

    // Lista wykluczeń z kodu Pythona użytkownika, Z WYJĄTKIEM "romtemp" bo używamy tego jako hall temp
    const wykluczone = ["gateway", "timeteller", "dør", "vannmåler", "etterfylling", "ekspansjon"];
    const wynik: Array<{ sn: string, name: string, is_hall_temp: boolean }> = [];

    for (const d of urzadzenia) {
        const info = d.info || {};
        const alias = (info.alias || "").toLowerCase();
        const tagi = String(info.tags || []).toLowerCase();
        const sn = d.sn || "";

        const saglinje_match = (
            alias.includes("3022") || tagi.includes("3022") ||
            alias.includes("sag") || alias.includes("saglinje") ||
            tagi.includes("saglinje")
        );

        const is_excluded = wykluczone.some(w => alias.includes(w));
        const is_hall_temp = alias.includes("romtemp") || tagi.includes("romtemp");

        if (saglinje_match && !is_excluded) {
            wynik.push({
                sn: sn,
                name: is_hall_temp ? "hala" : (info.alias || sn), // Używamy "hala" by python automatycznie rozpoznał to jako tło
                is_hall_temp: is_hall_temp
            });
        }
    }

    return wynik;
}

// 2. Pobieranie próbek z retry
async function fetchSamplesWithRetry(apiKey: string, systemId: string, sensorSn: string, startTs: string, endTs: string) {
    const url = `${NEURON_BASE_URL}/v2/systems/${systemId}/devices/${sensorSn}/samples?from=${startTs}&to=${endTs}`;
    const headers = { "ApiKey": apiKey };

    for (let proba = 1; proba <= 3; proba++) {
        try {
            const res = await fetch(url, { headers, next: { revalidate: 0 } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            return data.items || data; // Assuming data is in .items or direct array
        } catch (err) {
            if (proba === 3) {
                console.error(`Gjentatt feil for maskin ${sensorSn}:`, err);
                return [];
            }
            await new Promise(r => setTimeout(r, 500)); // Sleep 0.5s
        }
    }
    return [];
}

// 3. Główny endpoint POST
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { apiKey, systemId, startTime, endTime } = body;

        if (!apiKey || !systemId || !startTime || !endTime) {
            return NextResponse.json({ error: "Mangler obligatoriske felt (apiKey, systemId, startTime, endTime)" }, { status: 400 });
        }

        // Czas z UI podawany jest w formacie ISO => konwersja do timestamp ms jak w Pythonie (lub ISO string zależnie od API)
        const startTs = new Date(startTime).getTime();
        const endTs = new Date(endTime).getTime();

        // 1. Znajdź sensory saglinje
        let sensors = [];
        try {
            // Spróbuj formatu Bearer i ApiKey, dostosowując url wedle dokumentacji
            const url = `https://api.neuron.no/v2/systems/${systemId}/devices`; // Fallback to standard URL format if needed
            const res = await fetch(url, { headers: { "Authorization": `Bearer ${apiKey}` } });
            if (!res.ok) {
                // Try User Payload
                const res2 = await fetch(`https://api.neuron.no/systems/${systemId}/devices`, { headers: { "ApiKey": apiKey } });
                if (!res2.ok) throw new Error("Feil API Nøkkel eller System ID");
                const data = await res2.json();
                sensors = data;
            } else {
                const data = await res.json();
                sensors = data.items || data;
            }
        } catch (e) {
            // Simplified fetch for specific python structure
            const res = await fetch(`https://api.neuronics.no/v1/systems/${systemId}/devices`, { headers: { "ApiKey": apiKey } });
            if (res.ok) {
                sensors = await res.json();
            } else {
                return NextResponse.json({ error: "Feil ved tilkobling til Neuron API. Sjekk API nøkkel." }, { status: 401 });
            }
        }

        // Filtruj
        const wykluczone = ["gateway", "timeteller", "dør ", "vannmåler", "etterfylling", "ekspansjon"];
        const matchedSensors: Array<{ sn: string, alias: string, is_hall: boolean }> = [];

        for (const d of sensors) {
            const info = d.info || {};
            const alias = (info.alias || "").toLowerCase();
            const tagi = String(info.tags || []).toLowerCase();
            const sn = d.sn || "";

            const saglinje_match = (
                alias.includes("3022") || tagi.includes("3022") ||
                alias.includes("sag") || alias.includes("saglinje") ||
                tagi.includes("saglinje")
            );

            const is_excluded = wykluczone.some(w => alias.includes(w));
            const is_hall_temp = alias.includes("romtemp") || tagi.includes("romtemp");

            if (saglinje_match && !is_excluded) {
                matchedSensors.push({ sn, alias: info.alias || sn, is_hall: is_hall_temp });
            }
        }

        if (matchedSensors.length === 0) {
            return NextResponse.json({ error: "Ingen sensorer funnet for gruppen 'saglinje'." }, { status: 404 });
        }

        // Ograniczenie żeby nie przetwarzać 100 czujników i nie blokować pamięci
        if (matchedSensors.length > 20) {
            matchedSensors.length = 20;
        }

        const projectRoot = path.join(process.cwd(), '..');
        const batchId = 'API_' + crypto.randomBytes(4).toString('hex').toUpperCase();
        const savedFiles: string[] = [];

        // 2. Pobierz próbki dla każdego sensora i zapisz jako CSV
        for (const sTarget of matchedSensors) {
            let samples: any[] = [];
            for (let proba = 1; proba <= 3; proba++) {
                try {
                    // Endpoint v2 dla pobierania probek:
                    const res = await fetch(`${NEURON_BASE_URL}/v2/systems/${systemId}/devices/${sTarget.sn}/samples?from=${startTs}&to=${endTs}`, { headers: { "Authorization": `Bearer ${apiKey}` } });
                    if (res.ok) {
                        const sData = await res.json();
                        samples = sData.items || sData;
                        break;
                    } else if (res.status === 401 || res.status === 403) {
                        throw new Error("Feil API Nøkkel eller manglende tilgang.");
                    }
                } catch (e) {
                    if (proba === 3) console.error("Kunde ikke hente samples for", sTarget.sn);
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            if (!samples || samples.length === 0) continue;

            // Konwersja do CSV
            let csvContent = "sn;time;unit;value;timestamp\n";
            for (const sample of samples) {
                const ts = sample.timestamp || sample.time;
                if (!ts) continue;
                const isoStr = new Date(ts).toISOString();
                const v = sample.value;
                const u = sample.unit || (sTarget.is_hall ? 'C' : 'g');
                // Use a generic time format for the 'time' column to match python's expectation or just reuse timestamp
                csvContent += `${sTarget.sn};${isoStr};${u};${v};${isoStr}\n`;
            }

            const cleanAlias = sTarget.alias.replace(/[^a-zA-Z0-9]/g, '');
            const safeName = sTarget.is_hall ? `dane_hala_api_${cleanAlias}_${sTarget.sn}.csv` : `sensor_api_${cleanAlias}_${sTarget.sn}.csv`;
            const filePath = path.join(projectRoot, safeName);
            fs.writeFileSync(filePath, csvContent);
            savedFiles.push(safeName);
        }

        if (savedFiles.length === 0) {
            return NextResponse.json({ error: "Kunne ikke hente noe gyldig data fra sensorene." }, { status: 400 });
        }

        // 3. Uruchom pythona na zapisanej paczce API
        await new Promise<void>((resolve, reject) => {
            const args = ['analyze_batch.py', batchId, ...savedFiles];
            console.log("Running:", 'python', args.join(' '));

            const pythonProcess = spawn('python', args, { cwd: projectRoot, stdio: 'inherit' });

            pythonProcess.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Python script failed with code ${code}`));
            });
            pythonProcess.on('error', reject);
        });

        return NextResponse.json({
            message: 'Vellykket API-import og analyse',
            batchId: batchId,
            sensorsProcessed: savedFiles.length
        });

    } catch (error: any) {
        console.error('Neuron API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
