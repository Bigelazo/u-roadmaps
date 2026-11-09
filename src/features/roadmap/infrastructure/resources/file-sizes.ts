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
  for (const { id, fileKey } of resources) {
    const size = await uploadedFileSize(fileKey!);
    if (!size) {
      missing.push(id);
      continue;
    }
    measured += await prisma.$executeRaw`
      UPDATE "Resource" SET "fileSize" = ${size}
      WHERE id = ${id}::uuid AND "fileKey" = ${fileKey}::uuid AND "fileSize" IS NULL`;
  }
  return { measured, missing };
}
