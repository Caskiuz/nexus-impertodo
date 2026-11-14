// Compresión de imágenes en el cliente — misma receta que las fotos de inventario:
// reescala a 1000 px el lado mayor y exporta JPEG 0.82 (queda ~200-400 KB).
const MAX_FILE = 12 * 1024 * 1024; // 12 MB antes de comprimir

export async function compressImageFile(file: File | undefined, maxSide = 1000, quality = 0.82): Promise<string> {
  if (!file) throw new Error('Sin archivo seleccionado.');
  if (!file.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen (JPG, PNG, WEBP…).');
  if (file.size > MAX_FILE) throw new Error('La imagen pesa más de 12 MB. Elige una más ligera.');

  const dataOriginal = await new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onloadend = () => res(String(reader.result));
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const image = new Image();
    image.onload = () => res(image);
    image.onerror = () => rej(new Error('imagen ilegible'));
    image.src = dataOriginal;
  });

  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No pude procesar la imagen.');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}
