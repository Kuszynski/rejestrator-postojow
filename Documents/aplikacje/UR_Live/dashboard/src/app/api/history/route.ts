import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import util from 'util';

const execPromise = util.promisify(exec);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sn = searchParams.get('sn');

    if (!sn) {
        return NextResponse.json({ status: 'error', message: 'Missing sn parameter' }, { status: 400 });
    }

    try {
        // `get_chart_data.py` is located in python root directory `../../../../../../`
        // Wait, __dirname in Next.js points to output build directory.
        // process.cwd() in Next.js points to the `dashboard` directory.
        const projectRoot = path.join(process.cwd(), '..');
        const scriptPath = path.join(projectRoot, 'get_chart_data.py');
        
        const { stdout, stderr } = await execPromise(`python "${scriptPath}" "${sn}"`, {
             cwd: projectRoot,
             maxBuffer: 1024 * 1024 * 50 // 50MB buffer to handle large JSON logs
        });
        
        if (stderr && stderr.trim().length > 0) {
            console.warn("[get_chart_data] STDERR:", stderr);
        }

        const data = JSON.parse(stdout);
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("API History Error:", error);
        return NextResponse.json({
            status: "error",
            message: error.message || "Failed to execute python fetcher."
        }, { status: 500 });
    }
}
