export { dependencyTarget } from '@/shared/route-notice-target';

export function reconcileRouteNotice(
  known: string,
  current: string,
  target: 'dependency' | 'type' = 'dependency',
) {
  if (known === current) return null;
  return target === 'type'
    ? 'classification-updated'
    : current === 'true'
      ? 'dependency-added'
      : 'dependency-removed';
}
