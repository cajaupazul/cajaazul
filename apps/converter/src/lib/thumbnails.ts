import { Jimp } from 'jimp';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export async function generateImageThumbnail(inputPath: string, outputPath: string, width = 400): Promise<void> {
    const image = await Jimp.read(inputPath);
    image.resize({ w: width });
    await image.write(outputPath as any);
}

export async function generatePdfThumbnail(inputPath: string, outputPath: string, width = 400): Promise<void> {
    const tempDir = path.dirname(outputPath);

    return new Promise((resolve, reject) => {
        // LibreOffice PDF -> PNG (first page)
        const child = spawn('libreoffice', [
            '--headless',
            '--convert-to', 'png',
            '--outdir', tempDir,
            inputPath
        ]);

        child.on('error', (err: any) => {
            if (err.code === 'ENOENT') {
                reject(new Error('LibreOffice not found in PATH. Please install LibreOffice for document thumbnails.'));
            } else {
                reject(err);
            }
        });

        child.on('close', async (code) => {
            if (code !== 0) {
                return reject(new Error(`LibreOffice failed with code ${code}`));
            }

            const inputFileName = path.basename(inputPath);
            const inputBaseName = path.parse(inputFileName).name;
            const generatedPng = path.join(tempDir, inputBaseName + '.png');

            try {
                await fs.access(generatedPng);
                await generateImageThumbnail(generatedPng, outputPath, width);
                await fs.unlink(generatedPng);
                resolve();
            } catch (e) {
                reject(new Error('LibreOffice succeeded but output PNG not found'));
            }
        });
    });
}
