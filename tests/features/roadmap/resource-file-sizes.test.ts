import { beforeEach, expect, test, vi } from 'vitest';
import { backfillResourceFileSizes } from '@/features/roadmap/infrastructure/resources/file-sizes';

const storage = vi.hoisted(() => ({ stat: vi.fn() }));
const database = vi.hoisted(() => ({ findMany: vi.fn(), executeRaw: vi.fn() }));
vi.mock('@/features/roadmap/infrastructure/resources/filesystem', () => ({
  uploadedFileSize: storage.stat,
}));
vi.mock('@/shared/server/db', () => ({
  prisma: { resource: { findMany: database.findMany }, $executeRaw: database.executeRaw },
}));

const resources = Array.from({ length: 12 }, (_, index) => ({
  id: `resource-${index}`,
  fileKey: `file-${index}`,
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function flushTasks() {
  for (let turn = 0; turn < 20; turn++) await Promise.resolve();
}

beforeEach(() => {
  vi.resetAllMocks();
  database.findMany.mockResolvedValue(resources);
  database.executeRaw.mockResolvedValue(1);
  storage.stat.mockResolvedValue(10);
});

test('fills independent files concurrently without exceeding four active measurements', async () => {
  const gate = deferred();
  let active = 0;
  let maximum = 0;
  storage.stat.mockImplementation(async () => {
    active++;
    maximum = Math.max(maximum, active);
    await gate.promise;
    active--;
    return 10;
  });

  const outcome = backfillResourceFileSizes();
  await flushTasks();
  const firstBatch = storage.stat.mock.calls.length;
  gate.resolve();

  expect(await outcome).toEqual({ measured: 12, missing: [] });
  expect(firstBatch).toBe(4);
  expect(maximum).toBe(4);
  expect(database.executeRaw).toHaveBeenCalledTimes(12);
});

test.each(['file', 'database'])(
  'waits for started work after a %s failure and skips later batches',
  async (source) => {
    const gate = deferred();
    const failure = new Error(`${source} unavailable`);
    const boundary = source === 'file' ? storage.stat : database.executeRaw;
    boundary.mockRejectedValueOnce(failure).mockImplementation(async () => {
      await gate.promise;
      return source === 'file' ? 10 : 1;
    });
    let finished = false;
    const outcome = backfillResourceFileSizes().catch((cause: unknown) => {
      finished = true;
      return cause;
    });
    await flushTasks();
    const rejectedBeforeDrain = finished;
    gate.resolve();

    expect(await outcome).toBe(failure);
    expect(rejectedBeforeDrain).toBe(false);
    expect(storage.stat).toHaveBeenCalledTimes(4);
    expect(database.executeRaw).toHaveBeenCalledTimes(source === 'file' ? 3 : 4);
  },
);

test('keeps missing files in input order after out-of-order measurements and counts applied updates', async () => {
  const gate = deferred();
  database.findMany.mockResolvedValue(resources.slice(0, 5));
  storage.stat.mockImplementation(async (path: string) => {
    if (path.endsWith('file-1')) {
      await gate.promise;
      return null;
    }
    if (path.endsWith('file-3')) return null;
    if (path.endsWith('file-4')) return 0;
    return 10;
  });
  database.executeRaw.mockResolvedValueOnce(0);

  const outcome = backfillResourceFileSizes();
  await flushTasks();
  gate.resolve();

  expect(await outcome).toEqual({
    measured: 1,
    missing: ['resource-1', 'resource-3', 'resource-4'],
  });
  expect(database.executeRaw).toHaveBeenCalledWith(expect.any(Array), 10, 'resource-0', 'file-0');
});
