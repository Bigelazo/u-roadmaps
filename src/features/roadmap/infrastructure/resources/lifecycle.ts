import 'server-only';

import { copyUploadedFile, createStoredFile, deleteUploadedFile } from './filesystem';

export type ProvisionalStoredFiles = {
  upload(fileKey: string, file: File): Promise<void>;
  copyAll(copies: readonly { sourceFileKey: string; fileKey: string }[]): Promise<Set<string>>;
};

/** Best-effort cleanup also serves operations whose database change has already committed. */
export async function cleanupStoredFiles(operation: string, fileKeys: Iterable<string>) {
  await Promise.all(
    Array.from(fileKeys, async (fileKey) => {
      try {
        await deleteUploadedFile(fileKey);
      } catch (error) {
        console.warn('Stored file cleanup failed', { operation, fileKey, error });
      }
    }),
  );
}

/**
 * The callback returns only after the existing database orchestration commits.
 * Compensation is bounded to this process: crashes or persistent disk errors can leave bytes.
 */
export async function withStoredFiles<Result>(
  operation: string,
  run: (files: ProvisionalStoredFiles) => Promise<Result>,
): Promise<Result> {
  const owned = new Set<string>();
  const omitted = new Set<string>();
  const started: Promise<unknown>[] = [];
  function start<T>(write: () => Promise<T>): Promise<T> {
    const pending = write();
    started.push(pending);
    // A callback may fail before awaiting its write; the scope still waits and compensates it.
    void pending.catch(() => undefined);
    return pending;
  }
  async function create(fileKey: string) {
    const handle = await createStoredFile(fileKey);
    owned.add(fileKey);
    return handle;
  }
  try {
    const result = await run({
      upload: (fileKey, file) =>
        start(async () => {
          const handle = await create(fileKey);
          try {
            await handle.writeFile(Buffer.from(await file.arrayBuffer()));
          } catch (error) {
            await handle.close().catch((error) => {
              console.warn('Stored file close failed', { operation, fileKey, error });
            });
            throw error;
          }
          await handle.close();
        }),
      copyAll: async (copies) => {
        const results = await Promise.allSettled(
          copies.map(({ sourceFileKey, fileKey }) =>
            start(async () => {
              const handle = await create(fileKey);
              await handle.close();
              if (await copyUploadedFile(sourceFileKey, fileKey)) return fileKey;
              omitted.add(fileKey);
              return null;
            }),
          ),
        );
        const failure = results.find((result) => result.status === 'rejected');
        if (failure) throw failure.reason;
        return new Set(
          results.flatMap((result) =>
            result.status === 'fulfilled' && result.value ? [result.value] : [],
          ),
        );
      },
    });
    await Promise.all(started);
    await cleanupStoredFiles(operation, omitted);
    return result;
  } catch (error) {
    await Promise.allSettled(started);
    await cleanupStoredFiles(operation, owned);
    throw error;
  }
}
