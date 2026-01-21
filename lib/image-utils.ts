/**
 * Redimensiona una imagen a un tamaño cuadrado fijo (por defecto 512x512)
 * y devuelve un Blob optimizado.
 * Si skipResize es true, simplemente devuelve el archivo original como Blob.
 */
export async function resizeImage(
    file: File,
    size: number = 512,
    skipResize: boolean = false
): Promise<Blob> {
    if (skipResize) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('No se pudo obtener el contexto del canvas'));
                    return;
                }

                // Calcular dimensiones para un "center crop" o ajuste proporcional
                const scale = Math.max(size / img.width, size / img.height);
                const x = (size - img.width * scale) / 2;
                const y = (size - img.height * scale) / 2;

                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

                // Exportar como WebP optimizado (excepto si queremos GIF, pero Canvas no exporta GIF animados)
                canvas.toBlob(
                    (blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Error al generar el Blob'));
                    },
                    'image/webp',
                    0.85
                );
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
