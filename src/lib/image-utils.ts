/**
 * Utility functions for client-side image compression, resizing, and optimization.
 * Helps prevent Firestore document writes from exceeding the strict 1,048,576 byte (1MB) limit
 * when users upload high-resolution camera photos or large image files.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (default 0.75)
  maxSizeBytes?: number; // target max size in bytes, default 200KB (204,800 bytes)
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

const DEFAULT_OPTIONS: Required<CompressImageOptions> = {
  maxWidth: 300,
  maxHeight: 300,
  quality: 0.75,
  maxSizeBytes: 150 * 1024, // 150 KB safe threshold (well below Firestore 1MB)
  mimeType: 'image/jpeg',
};

/**
 * Loads an image source into an HTMLImageElement asynchronously
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image for compression: ' + err));
    img.src = src;
  });
}

/**
 * Calculates scaled dimensions preserving aspect ratio
 */
function calculateDimensions(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = srcWidth;
  let height = srcHeight;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  return { width: Math.max(1, width), height: Math.max(1, height) };
}

/**
 * Compresses an image element using an offscreen canvas
 */
function drawAndExportCanvas(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  mimeType: string,
  quality: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // If JPEG and image has transparency, paint white background first
  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  return canvas.toDataURL(mimeType, quality);
}

/**
 * Compresses a base64 data URL down to safe dimensions and file size
 */
export async function compressBase64Image(
  dataUrl: string,
  options?: CompressImageOptions
): Promise<string> {
  if (typeof window === 'undefined') {
    return dataUrl;
  }

  // If not a data URL or extremely short, return as-is
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  const opts: Required<CompressImageOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  // If already well below target size, skip
  if (dataUrl.length < 80 * 1024) {
    return dataUrl;
  }

  try {
    const img = await loadImage(dataUrl);
    let { width, height } = calculateDimensions(
      img.width || 300,
      img.height || 300,
      opts.maxWidth,
      opts.maxHeight
    );

    let quality = opts.quality;
    let mime = opts.mimeType;
    let result = drawAndExportCanvas(img, width, height, mime, quality);

    // Iteratively decrease quality and/or dimensions if still exceeding target size
    let attempts = 0;
    while (result.length > opts.maxSizeBytes && attempts < 4) {
      attempts++;
      quality = Math.max(0.3, quality - 0.15);
      width = Math.round(width * 0.85);
      height = Math.round(height * 0.85);
      result = drawAndExportCanvas(img, width, height, 'image/jpeg', quality);
    }

    return result;
  } catch (err) {
    console.warn('Image compression fallback:', err);
    return dataUrl;
  }
}

/**
 * Compresses an uploaded File or Blob into an optimized base64 data URL
 */
export async function compressImageFile(
  file: File | Blob,
  options?: CompressImageOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = async () => {
      try {
        const rawDataUrl = reader.result as string;
        const compressed = await compressBase64Image(rawDataUrl, options);
        resolve(compressed);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Calculates byte size of a data URL string
 */
export function estimateDataUrlSizeBytes(dataUrl: string): number {
  if (!dataUrl) return 0;
  if (!dataUrl.startsWith('data:')) return dataUrl.length;
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return dataUrl.length;
  const base64Str = dataUrl.slice(commaIndex + 1);
  return Math.round((base64Str.length * 3) / 4);
}
