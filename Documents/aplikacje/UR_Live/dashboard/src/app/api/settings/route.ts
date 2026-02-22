import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), '..');
const settingsPath = path.join(dataDir, 'daemon_settings.json');

export async function GET() {
    try {
        if (!fs.existsSync(settingsPath)) {
            return NextResponse.json({ use_hall_compensation: true });
        }
        const data = fs.readFileSync(settingsPath, 'utf8');
        return NextResponse.json(JSON.parse(data));
    } catch (error) {
        return NextResponse.json({ error: "Failed to read settings" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        fs.writeFileSync(settingsPath, JSON.stringify(body, null, 2), 'utf8');
        return NextResponse.json({ status: "ok" });
    } catch (error) {
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }
}
