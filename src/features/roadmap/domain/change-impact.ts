import { ruleRejection, type RuleRejection } from '@/features/roadmap/domain/rule-rejection';

/** The previewed changes whose confirmation can send back the Change impact's version. */
export type PreviewedChange = 'hide' | 'delete' | 'dependency' | 'block' | 'unlock';

const staleChanges = {
  hide: ['NODE_VISIBILITY_PREVIEW_STALE', 'de ocultar el nodo'],
  delete: ['NODE_DELETE_PREVIEW_STALE', 'de la eliminación'],
  dependency: ['DEPENDENCY_PREVIEW_STALE', 'de la dependencia'],
  block: ['TEACHER_BLOCK_PREVIEW_STALE', 'del bloqueo'],
  unlock: ['TEACHER_BLOCK_PREVIEW_STALE', 'del desbloqueo'],
} as const satisfies Record<PreviewedChange, readonly [string, string]>;

export type StalePreviewReason = (typeof staleChanges)[PreviewedChange][0];

/**
 * Whether a confirmation may take effect: the preview version it sends must still match
 * the current Change impact's `version`. A missing version passes, except for an unlock,
 * which must confirm the impact it previewed.
 */
export function decidePreviewVersion({
  change,
  sentVersion,
  version,
}: {
  change: PreviewedChange;
  sentVersion: string | undefined;
  version: string;
}): { kind: 'ALLOWED' } | RuleRejection<StalePreviewReason> {
  const isStale = sentVersion ? sentVersion !== version : change === 'unlock';
  if (!isStale) return { kind: 'ALLOWED' };
  const [reason, impact] = staleChanges[change];
  return ruleRejection(
    reason,
    `El impacto ${impact} cambió. Revisa y confirma la previsualización actualizada.`,
  );
}
