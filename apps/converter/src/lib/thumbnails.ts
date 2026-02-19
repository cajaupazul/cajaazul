import Jimp from 'jimp';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export async function generateImageThumbnail(inputPath: string, outputPath: string, width = 400): Promise<void> {
    const image = await Jimp.read(inputPath);
    await image
        .resize(width, Jimp.AUTO) // Resize
        .quality(80) // Set JPEG quality
        .writeAsync(outputPath); // Save
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

        child.on('close', async (code) => {
            if (code !== 0) {
                return reject(new Error(`LibreOffice failed with code ${code}`));
            }

            // LibreOffice usually names it [original_name].png
            const inputFileName = path.basename(inputPath);
            const inputBaseName = path.parse(inputFileName).name;
            const generatedPng = path.join(tempDir, inputBaseName + '.png');

            try {
                await fs.access(generatedPng);
                // Now resize the generated PNG with Jimp to match our target size/quality
                await generateImageThumbnail(generatedPng, outputPath, width);
                // Cleanup the big PNG
                await fs.unlink(generatedPng);
                resolve();
            } catch (e) {
                console.error('File not found:', generatedPng);
                reject(new Error('LibreOffice succeeded but output PNG not found'));
            }
        });

        child.on('error', (err) => {
            reject(new Error(`Failed to start LibreOffice: ${err.message}`));
        });
    });
}
