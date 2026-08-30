import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const maxUploadBytes = 25 * 1024 * 1024;
const storageDirectory = join(process.cwd(), 'uploads');

function storagePath(fileKey: string) {
  return join(storageDirectory, fileKey);
}

export function validateUploadedFile(file: File) {
  if (!file.size) throw new Error('EMPTY_FILE');
  if (file.size > maxUploadBytes) throw new Error('FILE_TOO_LARGE');
}

export async function saveUploadedFile(fileKey: string, file: File) {
  await mkdir(storageDirectory, { recursive: true });
  await writeFile(storagePath(fileKey), Buffer.from(await file.arrayBuffer()), { flag: 'wx' });
}

export async function readUploadedFile(fileKey: string) {
  return readFile(storagePath(fileKey));
}

export async function deleteUploadedFile(fileKey: string) {
  await rm(storagePath(fileKey), { force: true });
}
