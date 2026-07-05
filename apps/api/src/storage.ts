import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.resolve(moduleDir, '../../../data/uploads');

export async function storeUploadFile(file: { originalname: string; buffer: Buffer; size: number; mimetype: string }) {
  await mkdir(uploadRoot, { recursive: true });
  const extension = path.extname(file.originalname).toLowerCase();
  const safeName = `${Date.now()}-${randomUUID()}${extension}`;
  const targetPath = path.join(uploadRoot, safeName);
  await writeFile(targetPath, file.buffer);
  return { id: safeName, fileName: safeName, originalName: file.originalname, size: file.size, storagePath: targetPath };
}
