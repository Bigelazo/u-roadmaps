export type TargetReconciliation =
  | { action: 'create' | 'update'; knownValue: string; currentValue: string }
  | { action: 'withdraw' }
  | { action: 'no-op' };

/** Compares one Notice target with the recipient's Known value and pending notice. */
export function reconcileTarget({
  knownValue,
  pending,
  currentValue,
}: {
  knownValue: string;
  pending: { knownValue: string; currentValue: string } | null;
  currentValue: string;
}): TargetReconciliation {
  if (currentValue === knownValue) return { action: pending ? 'withdraw' : 'no-op' };
  if (pending && pending.currentValue === currentValue && pending.knownValue === knownValue)
    return { action: 'no-op' };
  return { action: pending ? 'update' : 'create', knownValue, currentValue };
}
