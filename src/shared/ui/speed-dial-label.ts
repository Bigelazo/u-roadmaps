const pinnedLabelAttribute = 'data-pinned-label';

export function pinSpeedDialLabel(action: Element) {
  action.setAttribute(pinnedLabelAttribute, '');
}
