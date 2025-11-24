import sharp from 'sharp';
import { unlink } from 'fs/promises';

export interface ImageProcessingOptions {
  width: number;
  height: number;
  quality?: number;
}

/**
 * Process and optimize an uploaded image
 * - Resizes to specified dimensions
 * - Converts to WebP format
 * - Optimizes quality
 */
export async function processUploadedImage(
  filePath: string,
  options: ImageProcessingOptions
): Promise<void> {
  const { width, height, quality = 90 } = options;
  const processedPath = filePath + '.tmp';

  try {
    // Process image with sharp
    await sharp(filePath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality })
      .toFile(processedPath);

    // Replace original with processed
    await unlink(filePath);
    await sharp(processedPath).toFile(filePath);
    await unlink(processedPath);
  } catch (error) {
    // Clean up temporary file if it exists
    try {
      await unlink(processedPath);
    } catch (e) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Validate uploaded image file
 */
export function validateImageFile(
  file: Express.Multer.File | undefined
): void {
  if (!file) {
    throw new Error('No file uploaded');
  }

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error('Only image files (jpg, png, webp) are allowed');
  }
}
