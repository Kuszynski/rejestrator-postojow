import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const files = formData.getAll('file') as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'Ingen filer valgt' }, { status: 400 });
        }

        const projectRoot = path.join(process.cwd(), '..');

        const batchId = 'BATCH_' + crypto.randomBytes(4).toString('hex').toUpperCase();

        // --- CLEANUP: Usuń wszystkie stare pliki CSV przed nowym wgrywaniem ---
        try {
            const oldFiles = fs.readdirSync(projectRoot).filter(f => f.endsWith('.csv'));
            for (const oldFile of oldFiles) {
                fs.unlinkSync(path.join(projectRoot, oldFile));
            }
            console.log(`[UPLOAD CLEANUP] Usunięto ${oldFiles.length} starych plików CSV.`);
        } catch (cleanupErr) {
            console.error('[UPLOAD CLEANUP] Błąd podczas usuwania starych plików:', cleanupErr);
        }
        // --------------------------------------------------------------------------

        const savedFiles: string[] = [];

        // Save all files to root directory
        for (const file of files) {
            if (!file.name.endsWith('.csv')) continue;

            const buffer = Buffer.from(await file.arrayBuffer());
            const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
            const safeName = file.name.replace(/[^a-zA-Z0-9_\-\.]/g, '');
            const filePath = path.join(projectRoot, safeName);

            console.log(`[UPLOAD] Saving ${safeName} (${sizeMB} MB)`);
            fs.writeFileSync(filePath, buffer);
            savedFiles.push(safeName);
        }

        if (savedFiles.length === 0) {
            return NextResponse.json({ error: 'Ingen gyldige CSV-filer funnet' }, { status: 400 });
        }

        // Uruchom analizę grupową (batch)
        // arg[0] = batchId, arg[1...] = file names
        await new Promise<void>((resolve, reject) => {
            const args = ['analyze_batch.py', batchId, ...savedFiles];
            console.log("Running:", 'python', args.join(' '));

            const pythonProcess = spawn('python', args, {
                cwd: projectRoot,
                stdio: 'inherit'
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Python script failed with code ${code}`));
                }
            });

            pythonProcess.on('error', (err) => {
                reject(err);
            });
        });

        return NextResponse.json({
            message: 'Vellykket batch-analyse',
            batchId: batchId,
            filesProcessed: savedFiles
        });

    } catch (error: any) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
