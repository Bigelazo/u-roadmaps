export type NodeContentReconciliation =
  | { action: 'create' | 'update'; knownValue: string; currentValue: string }
  | { action: 'withdraw' }
  | { action: 'no-op' };

/** Compares one content target with the recipient's last recognized value. */
export function reconcileNodeContentNotice({
  knownValue,
  pendingValue,
  pendingKnownValue,
  currentValue,
}: {
  knownValue: string;
  pendingValue: string | null;
  pendingKnownValue: string | null;
  currentValue: string;
}): NodeContentReconciliation {
  if (currentValue === knownValue) return { action: pendingValue === null ? 'no-op' : 'withdraw' };
  if (currentValue === pendingValue && knownValue === pendingKnownValue) return { action: 'no-op' };
  return { action: pendingValue === null ? 'create' : 'update', knownValue, currentValue };
}
