'use client';

/**
 * Client-side thumbnail generator.
 * Supports PDF (via PDF.js) and images (via Canvas).
 * Returns null for unsupported types (Office docs) — caller handles fallback.
 */

const PDF_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
const THUMB_WIDTH = 600;
const THUMB_QUALITY = 0.82;

export async function generateThumbnailFromFile(file: File): Promise<Blob | null> {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    try {
        if (ext === 'pdf') {
            return await generatePdfThumbnail(file);
        }

        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
            return await generateImageThumbnail(file);
        }

        // Office files (ppt, pptx, doc, docx, xls, xlsx) — not renderable client-side
        return null;
    } catch (err) {
        console.warn('[THUMBNAIL] Generation failed:', err);
        return null;
    }
}

async function generatePdfThumbnail(file: File): Promise<Blob | null> {
    // Dynamically import pdfjs-dist to avoid SSR issues
    const pdfjs = await import('pdfjs-dist');

    // Set worker source (CDN to avoid bundling the heavy worker)
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_CDN;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    // Scale so the rendered page is THUMB_WIDTH pixels wide
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = THUMB_WIDTH / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    return canvasToWebpBlob(canvas);
}

async function generateImageThumbnail(file: File): Promise<Blob | null> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            const scale = THUMB_WIDTH / img.width;
            const canvas = document.createElement('canvas');
            canvas.width = THUMB_WIDTH;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            URL.revokeObjectURL(url);
            canvasToWebpBlob(canvas).then(resolve).catch(() => resolve(null));
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };

        img.src = url;
    });
}

function canvasToWebpBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
    return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/webp', THUMB_QUALITY);
    });
}
