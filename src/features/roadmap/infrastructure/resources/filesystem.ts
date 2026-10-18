import 'server-only';

import { copyFile, mkdir, open, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const maxUploadBytes = 25 * 1024 * 1024;
// Uploaded files are runtime data, not build dependencies.
const storageDirectory = join(
  /* turbopackIgnore: true */ process.cwd(),
  process.env.UPLOADS_DIRECTORY || 'uploads',
);

function storagePath(fileKey: string) {
  return join(storageDirectory, fileKey);
}

export function validateUploadedFile(file: File) {
  if (!file.size) throw new Error('EMPTY_FILE');
  if (file.size > maxUploadBytes) throw new Error('FILE_TOO_LARGE');
}

/** A successful exclusive open proves ownership before any content is written. */
export async function createStoredFile(fileKey: string) {
  await mkdir(storageDirectory, { recursive: true });
  return open(storagePath(fileKey), 'wx');
}

export async function readUploadedFile(fileKey: string) {
  return readFile(storagePath(fileKey));
}

export async function deleteUploadedFile(fileKey: string) {
  await rm(storagePath(fileKey), { force: true });
}

/** Writes into an already exclusively owned destination; false for a missing source. */
export async function copyUploadedFile(sourceFileKey: string, fileKey: string) {
  await mkdir(storageDirectory, { recursive: true });
  try {
    await copyFile(storagePath(sourceFileKey), storagePath(fileKey));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
