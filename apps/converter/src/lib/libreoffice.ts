import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export class ConversionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConversionError';
    }
}

export async function convertToPdf(inputPath: string, outputDir: string, timeoutMs = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
        // Ensure output dir exists
        // The command: libreoffice --headless --nologo --nofirststartwizard --convert-to pdf --outdir <dir> <file>

        // Safety check: input must exist

        const jobId = path.basename(outputDir);
        const profilePath = `/tmp/libreoffice_profile_${jobId}`;
        
        const child = spawn('xvfb-run', [
            '--auto-servernum',
            '--server-args=-screen 0 1024x768x24',
            'libreoffice',
            '--headless',
            '--nologo',
            '--nofirststartwizard',
            '--invisible',
            '--nodefault',
            '--norestore',
            '--nolockcheck',
            '--convert-to', 'pdf',
            '--outdir', outputDir,
            `-env:UserInstallation=file://${profilePath}`,
            inputPath
        ]);

        let timeout: NodeJS.Timeout;

        // Increased timeout: PPTs can be slow
        if (timeoutMs > 0) {
            const actualTimeout = Math.max(timeoutMs, 90000); // Minimum 90s
            timeout = setTimeout(() => {
                child.kill('SIGKILL');
                reject(new ConversionError(`Conversion timed out after ${actualTimeout}ms`));
            }, actualTimeout);
        }

        let stderr = '';

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', async (code) => {
            if (timeout) clearTimeout(timeout);

            if (code !== 0) {
                console.error('LibreOffice failed:', stderr);
                return reject(new ConversionError(`LibreOffice exited with code ${code}: ${stderr}`));
            }

            // Determine expected output filename
            const originalName = path.basename(inputPath, path.extname(inputPath));
            const expectedOutput = path.join(outputDir, `${originalName}.pdf`);

            try {
                await fs.access(expectedOutput);
                resolve(expectedOutput);
            } catch (e) {
                reject(new ConversionError('Output PDF not found after conversion'));
            }
        });

        child.on('error', (err) => {
            if (timeout) clearTimeout(timeout);
            reject(new ConversionError(`Failed to start LibreOffice: ${err.message}`));
        });
    });
}
