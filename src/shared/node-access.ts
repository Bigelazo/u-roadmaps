/** The recipient-visible states of a Node access Notice target. */
export const NODE_ACCESS_STATES = ['Disponible', 'Bloqueado', 'Retirado'] as const;
export type NodeAccessState = (typeof NODE_ACCESS_STATES)[number];

export function nodeAccessState(isVisible: boolean, isAccessible: boolean): NodeAccessState {
  return !isVisible ? 'Retirado' : isAccessible ? 'Disponible' : 'Bloqueado';
}

const accessNoticeByState = {
  Disponible: { changeKind: 'node-available', targetKind: 'node' },
  Bloqueado: { changeKind: 'node-blocked', targetKind: 'roadmap' },
  Retirado: { changeKind: 'node-retired', targetKind: 'roadmap' },
} as const;

export function accessNoticeDestination(state: string) {
  if (!NODE_ACCESS_STATES.includes(state as NodeAccessState))
    throw new Error('Invalid Node access state.');
  return accessNoticeByState[state as NodeAccessState];
}
