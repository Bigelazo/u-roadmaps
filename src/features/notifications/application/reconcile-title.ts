export type TitleReconciliation =
  | { action: 'create' | 'update'; knownTitle: string; currentTitle: string }
  | { action: 'withdraw' }
  | { action: 'no-op' };

/** Compares one title target with the recipient's last recognized value. */
export function reconcileTitleNotice({
  knownTitle,
  pendingTitle,
  pendingKnownTitle,
  currentTitle,
}: {
  knownTitle: string;
  pendingTitle: string | null;
  pendingKnownTitle: string | null;
  currentTitle: string;
}): TitleReconciliation {
  if (currentTitle === knownTitle) return { action: pendingTitle === null ? 'no-op' : 'withdraw' };
  if (currentTitle === pendingTitle && knownTitle === pendingKnownTitle) return { action: 'no-op' };
  return { action: pendingTitle === null ? 'create' : 'update', knownTitle, currentTitle };
}
