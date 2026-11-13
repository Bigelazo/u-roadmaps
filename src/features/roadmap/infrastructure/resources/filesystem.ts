import 'server-only';

import { copyFile, mkdir, open, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { MAX_RESOURCE_FILE_BYTES } from '@/features/roadmap/domain/resource';
const storageDirectory = join(
  /* turbopackIgnore: true */ process.cwd(),
  process.env.UPLOADS_DIRECTORY || 'uploads',
);

function storagePath(fileKey: string) {
  return join(storageDirectory, fileKey);
}

export function validateUploadedFile(file: File) {
  if (!file.size) throw new Error('EMPTY_FILE');
  if (file.size > MAX_RESOURCE_FILE_BYTES) throw new Error('FILE_TOO_LARGE');
}

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

export async function uploadedFileSize(fileKey: string) {
  try {
    return (await stat(storagePath(fileKey))).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
