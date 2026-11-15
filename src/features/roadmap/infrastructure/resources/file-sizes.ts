import 'server-only';

import { prisma } from '@/shared/server/db';
import { uploadedFileSize } from './filesystem';

export async function backfillResourceFileSizes() {
  const resources = await prisma.resource.findMany({
    where: { type: 'FILE', fileSize: null, fileKey: { not: null } },
    select: { id: true, fileKey: true },
  });
  const missing: string[] = [];
  let measured = 0;
  const batchSize = 4;
  for (let offset = 0; offset < resources.length; offset += batchSize) {
    const batch = resources.slice(offset, offset + batchSize);
    const results = await Promise.allSettled(
      batch.map(async ({ id, fileKey }) => {
        const size = await uploadedFileSize(fileKey!);
        if (!size) return { id, measured: 0, missing: true };
        const updated = await prisma.$executeRaw`
          UPDATE "Resource" SET "fileSize" = ${size}
          WHERE id = ${id}::uuid AND "fileKey" = ${fileKey}::uuid AND "fileSize" IS NULL`;
        return { id, measured: updated, missing: false };
      }),
    );
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason;
      if (result.value.missing) missing.push(result.value.id);
      measured += result.value.measured;
    }
  }
  return { measured, missing };
}
