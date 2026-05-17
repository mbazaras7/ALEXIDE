import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';

const MAX_FILE_SIZE = 10 * 1024 * 1024; //10MB

const storage = multer.memoryStorage();

const blockedExtensions = ['.exe', '.bat', '.sh', '.cmd', '.msi', '.dll'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fileFilter = (_req: Request, file: any, cb: FileFilterCallback): void => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (blockedExtensions.includes(ext)) {
    cb(new Error(`File type ${ext} is not allowed`));
    return;
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});
