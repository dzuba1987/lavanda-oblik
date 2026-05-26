/**
 * Resize image file to fit within maxSize (px) on the longer side
 * and re-encode as JPEG data URL ("data:image/jpeg;base64,...").
 * For storage in Firestore documents — keep maxSize/quality small.
 */
export async function imageToBase64Jpeg(
  file: File,
  maxSize = 800,
  quality = 0.7
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Файл не є зображенням");
  }

  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, maxSize);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context недоступний");
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

function fitWithin(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w >= h ? max / w : max / h;
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не вдалось прочитати зображення"));
    img.src = src;
  });
}
