import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';

export const imageFileFilter = (
  req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
  const ext = extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    return callback(
      new BadRequestException(
        `Invalid file type. Allowed types: ${allowedExtensions.join(', ')}`
      ),
      false,
    );
  }
  
  callback(null, true);
};

export const editFileName = (
  req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, filename: string) => void,
) => {
  const name = file.originalname.split('.')[0];
  const fileExtName = extname(file.originalname);
  const randomName = Array(16)
    .fill(null)
    .map(() => Math.round(Math.random() * 16).toString(16))
    .join('');
  
  callback(null, `${name}-${randomName}${fileExtName}`);
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB