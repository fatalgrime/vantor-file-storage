/**
 * Image orientation and EXIF helper utilities.
 * Handles reading EXIF orientation tags from JPEGs and normalizing image orientation
 * via HTML5 Canvas to guarantee consistent upright display on initial load.
 */

import { VantorFile } from './types';

/**
 * Parses the EXIF orientation tag from an ArrayBuffer of JPEG image binary data.
 * @returns Orientation value 1..8 (1 = normal upright).
 */
export function getExifOrientation(buffer: ArrayBuffer): number {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 2 || view.getUint16(0, false) !== 0xFFD8) {
      return 1; // Not a valid JPEG image
    }

    const length = view.byteLength;
    let offset = 2;

    while (offset < length) {
      if (offset + 4 > length) break;
      const marker = view.getUint16(offset, false);
      offset += 2;

      if (marker === 0xFFE1) {
        if (offset + 6 > length) break;
        // Check for "Exif\0\0" header
        if (view.getUint32(offset + 2, false) !== 0x45786966) {
          return 1;
        }

        const little = view.getUint16(offset + 8, false) === 0x4949; // "II" vs "MM"
        const ifdOffset = view.getUint32(offset + 12, little);
        let dirOffset = offset + 8 + ifdOffset;

        if (dirOffset + 2 > length) break;
        const tags = view.getUint16(dirOffset, little);
        dirOffset += 2;

        for (let i = 0; i < tags; i++) {
          const entryOffset = dirOffset + (i * 12);
          if (entryOffset + 12 > length) break;
          // Tag 0x0112 is Orientation
          if (view.getUint16(entryOffset, little) === 0x0112) {
            return view.getUint16(entryOffset + 8, little);
          }
        }
      } else if ((marker & 0xFF00) !== 0xFF00) {
        break;
      } else {
        const blockLength = view.getUint16(offset, false);
        offset += blockLength;
      }
    }
  } catch (err) {
    console.warn('Failed to parse EXIF orientation:', err);
  }
  return 1;
}

/**
 * Resolves a displayable image URL from a VantorFile record.
 */
export function resolveImageSrc(file: Partial<VantorFile> | null | undefined): string {
  if (!file) return '';

  if (file.content) {
    if (file.content.startsWith('data:')) {
      return file.content;
    }
    // Handle raw base64 string
    if (file.content.length > 50 && !file.content.includes(' ')) {
      const mime = file.mimeType || 'image/jpeg';
      return `data:${mime};base64,${file.content}`;
    }
  }

  if (file.url) {
    return file.url;
  }

  return '';
}



/**
 * Normalizes an image's EXIF orientation by physically rotating/transforming
 * it onto an HTML5 Canvas if needed. Guarantees the output image renders upright (0°).
 */
export async function normalizeImageOrientation(
  imageSrc: string,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  if (!imageSrc || typeof window === 'undefined') return imageSrc;

  try {
    let arrayBuffer: ArrayBuffer | null = null;

    if (imageSrc.startsWith('data:')) {
      const parts = imageSrc.split(',');
      const base64Str = parts[1] || parts[0];
      if (base64Str) {
        const binaryStr = window.atob(base64Str);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      }
    } else if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://') || imageSrc.startsWith('/') || imageSrc.startsWith('blob:')) {
      const response = await fetch(imageSrc);
      if (response.ok) {
        arrayBuffer = await response.arrayBuffer();
      }
    }

    let orientation = arrayBuffer ? getExifOrientation(arrayBuffer) : 1;

    if (orientation <= 1) {
      return imageSrc; // Already upright (Standard EXIF 1)
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = imageSrc;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageSrc;

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    // Swap dimensions for 90° / 270° rotations
    if (orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8) {
      canvas.width = height;
      canvas.height = width;
    } else {
      canvas.width = width;
      canvas.height = height;
    }

    switch (orientation) {
      case 2: // Horizontal flip
        ctx.transform(-1, 0, 0, 1, width, 0);
        break;
      case 3: // 180° rotation (Upside down)
        ctx.transform(-1, 0, 0, -1, width, height);
        break;
      case 4: // Vertical flip
        ctx.transform(1, 0, 0, -1, 0, height);
        break;
      case 5: // Vertical flip + 90° rotate
        ctx.transform(0, 1, 1, 0, 0, 0);
        break;
      case 6: // 90° CW rotate
        ctx.transform(0, 1, -1, 0, height, 0);
        break;
      case 7: // Horizontal flip + 90° rotate
        ctx.transform(0, -1, -1, 0, height, width);
        break;
      case 8: // 270° CW rotate
        ctx.transform(0, -1, 1, 0, 0, width);
        break;
      default:
        break;
    }

    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL(mimeType || 'image/jpeg', 0.95);
  } catch (err) {
    console.warn('Image orientation normalization fallback:', err);
    return imageSrc;
  }
}
