import { ruleRejection, type RuleRejection } from '@/features/roadmap/domain/rule-rejection';

export type ChangeWithImpact = 'hide' | 'delete' | 'dependency' | 'block' | 'unlock';

const staleChanges = {
  hide: ['NODE_VISIBILITY_PREVIEW_STALE', 'de ocultar el nodo'],
  delete: ['NODE_DELETE_PREVIEW_STALE', 'de la eliminación'],
  dependency: ['DEPENDENCY_PREVIEW_STALE', 'de la dependencia'],
  block: ['TEACHER_BLOCK_PREVIEW_STALE', 'del bloqueo'],
  unlock: ['TEACHER_BLOCK_PREVIEW_STALE', 'del desbloqueo'],
} as const satisfies Record<ChangeWithImpact, readonly [string, string]>;

export type StaleChangeImpactReason = (typeof staleChanges)[ChangeWithImpact][0];

export function decideChangeImpactVersion({
  change,
  sentVersion,
  version,
}: {
  change: ChangeWithImpact;
  sentVersion: string | undefined;
  version: string;
}): { kind: 'ALLOWED' } | RuleRejection<StaleChangeImpactReason> {
  if (sentVersion === version) return { kind: 'ALLOWED' };
  const [reason, impact] = staleChanges[change];
  return ruleRejection(
    reason,
    `El impacto ${impact} cambió. Revisa y confirma la previsualización actualizada.`,
  );
}
