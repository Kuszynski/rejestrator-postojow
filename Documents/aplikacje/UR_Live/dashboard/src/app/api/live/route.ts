import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Endpoint zwraca aktualny stan z live_status.json
export async function GET() {
    try {
        // Scieżka do wygenerowanego przez live_daemon.py pliku.
        // Dashboard Next.js będzie znajdował się o folder niżej niż główny Daemon Pythona.
        const dataDir = process.env.DATA_DIR || path.join(process.cwd(), '..');
        const statusPath = path.join(dataDir, 'live_status.json');

        if (!fs.existsSync(statusPath)) {
            return NextResponse.json({
                status: "waiting",
                message: "Oczekuję na pierwszy cykl demona live_daemon.py..."
            }, { status: 202 });
        }

        // Ze względu na os.replace (Atomowość) odczyt fs.readFileSync użyje zawsze nienaruszonego JSON
        const data = fs.readFileSync(statusPath, 'utf8');
        const statusObj = JSON.parse(data);

        return NextResponse.json({
            status: "ok",
            data: statusObj
        });

    } catch (error) {
        console.error("Błąd odczytu live_status.json: ", error);
        return NextResponse.json({
            status: "error",
            message: "Błąd serwera przy odczycie statusu."
        }, { status: 500 });
    }
}
