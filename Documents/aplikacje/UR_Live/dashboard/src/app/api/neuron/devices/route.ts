import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { apiKey, systemId } = body;

        if (!apiKey || !systemId) {
            return NextResponse.json({ error: "Mangler apiKey eller systemId" }, { status: 400 });
        }

        let sensors = [];
        try {
            const url = `https://api.neuronsensors.app/v2/systems/${systemId}/devices`;
            const res = await fetch(url, { headers: { "ApiKey": apiKey } });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Feil API Nøkkel eller System ID (${res.status}). Svar: ${errText.substring(0, 50)}`);
            }
            const data = await res.json();
            sensors = data;
        } catch (e: any) {
            return NextResponse.json({ error: `Network exception: ${e.message}` }, { status: 500 });
        }

        const wykluczone = ["gateway", "timeteller", "dør", "vannmåler", "etterfylling", "ekspansjon"];
        const matchedSensors: Array<{ sn: string, alias: string, is_hall: boolean }> = [];

        if (Array.isArray(sensors)) {
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
        } else {
            return NextResponse.json({ error: "API Response format not recognized." }, { status: 500 });
        }

        if (matchedSensors.length === 0) {
            return NextResponse.json({ error: "Ingen sensorer funnet for filteret 'saglinje'." }, { status: 404 });
        }

        return NextResponse.json({ devices: matchedSensors });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
