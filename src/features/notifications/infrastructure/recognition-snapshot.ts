import 'server-only';
import type { Prisma } from '@/shared/server/db';

/** Validate the common envelope before a target interprets its captured payload. */
export function recognitionSnapshot(value: Prisma.JsonValue): {
  id: string;
  payload: Prisma.JsonValue;
} {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    typeof value.id !== 'string' ||
    value.payload === undefined
  )
    throw new Error('Invalid notice opening snapshot.');
  return { id: value.id, payload: value.payload };
}

/** Acknowledge only when the pending target still matches the captured value. */
export async function acknowledgeCapturedNotice(
  transaction: Prisma.TransactionClient,
  identity: { id: string; recipientId: string; roadmapId: string },
  matchesSnapshot: (data: Prisma.JsonValue) => boolean,
): Promise<number> {
  const captured = await transaction.roadmapNotice.findFirst({
    where: { ...identity, acknowledgedAt: null },
  });
  if (!captured || !matchesSnapshot(captured.data)) return 0;
  await transaction.roadmapNotice.update({
    where: { id: captured.id },
    data: { acknowledgedAt: new Date() },
  });
  return 1;
}

/** Synthetic entry baselines must not bypass the delivery path's author filtering. */
export async function reconcileRecognizedTarget(
  transaction: Prisma.TransactionClient,
  identity: { recipientId: string; roadmapId: string; targetKey: string },
  onlyPending: boolean,
  reconcile: () => Promise<void>,
) {
  if (
    onlyPending &&
    !(await transaction.roadmapNotice.findFirst({
      where: { ...identity, acknowledgedAt: null },
      select: { id: true },
    }))
  )
    return;
  await reconcile();
}
