import { reconcileNodeContentNotice } from './reconcile-node-content';

export type TitleReconciliation =
  | { action: 'create' | 'update'; knownTitle: string; currentTitle: string }
  | { action: 'withdraw' }
  | { action: 'no-op' };

export function reconcileTitleNotice(input: {
  knownTitle: string;
  pendingTitle: string | null;
  pendingKnownTitle: string | null;
  currentTitle: string;
}): TitleReconciliation {
  const result = reconcileNodeContentNotice({
    knownValue: input.knownTitle,
    pendingValue: input.pendingTitle,
    pendingKnownValue: input.pendingKnownTitle,
    currentValue: input.currentTitle,
  });
  return result.action === 'create' || result.action === 'update'
    ? { action: result.action, knownTitle: result.knownValue, currentTitle: result.currentValue }
    : { action: result.action };
}
