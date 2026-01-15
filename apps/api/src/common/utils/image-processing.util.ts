import sharp from 'sharp';
import { unlink, rename } from 'fs/promises';

export interface ImageProcessingOptions {
  width: number;
  height: number;
  quality?: number;
}

/**
 * Helper to safely delete a file with retries (Windows file locking workaround)
 */
async function safeUnlink(filePath: string, retries = 3, delay = 100): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await unlink(filePath);
      return;
    } catch (error: any) {
      if (error.code === 'EBUSY' && i < retries - 1) {
        // Wait a bit for file handles to be released
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
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
  const processedPath = filePath + '.processed';

  try {
    // Process image with sharp - use toBuffer then write to avoid file handle issues
    const processedBuffer = await sharp(filePath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality })
      .toBuffer();

    // Write the processed buffer directly to the final location
    await sharp(processedBuffer).toFile(processedPath);

    // Delete original and rename processed to original
    await safeUnlink(filePath);
    await rename(processedPath, filePath);
  } catch (error) {
    // Clean up temporary file if it exists
    try {
      await safeUnlink(processedPath);
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
