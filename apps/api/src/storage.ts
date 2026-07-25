import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.resolve(moduleDir, '../../../data/uploads');
const communityCertificateRoot = path.join(uploadRoot, 'community-certificates');

const certificateExtensions: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

function certificateSignatureMatches(mimetype: string, buffer: Buffer) {
  if (mimetype === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimetype === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimetype === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimetype === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

function resolvePrivateCertificatePath(storagePath: string) {
  const resolved = path.resolve(storagePath);
  if (!resolved.startsWith(`${communityCertificateRoot}${path.sep}`)) {
    throw new Error('Caminho de certificado inválido.');
  }
  return resolved;
}

export async function storeUploadFile(file: { originalname: string; buffer: Buffer; size: number; mimetype: string }) {
  await mkdir(uploadRoot, { recursive: true });
  const extension = path.extname(file.originalname).toLowerCase();
  const safeName = `${Date.now()}-${randomUUID()}${extension}`;
  const targetPath = path.join(uploadRoot, safeName);
  await writeFile(targetPath, file.buffer);
  return { id: safeName, fileName: safeName, originalName: file.originalname, size: file.size, storagePath: targetPath };
}

export type CommunityCertificateFile = {
  originalname: string;
  buffer: Buffer;
  size: number;
  mimetype: string;
};

export async function storeCommunityCertificate(file: CommunityCertificateFile) {
  const extension = certificateExtensions[file.mimetype];
  if (!extension || !certificateSignatureMatches(file.mimetype, file.buffer)) {
    throw new Error('O certificado precisa ser um PDF, JPG, PNG ou WebP válido.');
  }
  if (!file.size || file.size > 10 * 1024 * 1024) {
    throw new Error('O certificado deve ter no máximo 10 MB.');
  }

  await mkdir(communityCertificateRoot, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const storagePath = path.join(communityCertificateRoot, fileName);
  const originalName = path.basename(file.originalname).slice(0, 180) || `certificado${extension}`;
  const sha256 = createHash('sha256').update(file.buffer).digest('hex');
  await writeFile(storagePath, file.buffer, { flag: 'wx' });
  return {
    originalName,
    mimetype: file.mimetype,
    size: file.size,
    storagePath,
    sha256
  };
}

export async function readCommunityCertificate(storagePath: string) {
  return readFile(resolvePrivateCertificatePath(storagePath));
}

export async function removeCommunityCertificate(storagePath: string) {
  await unlink(resolvePrivateCertificatePath(storagePath)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
}
