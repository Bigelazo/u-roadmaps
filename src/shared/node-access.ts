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

/** Describe what happened to the Node, comparing the last known state with the current one. */
export function nodeAccessChangeText(title: string, known: string, current: string) {
  const node = `«${title}»`;
  if (current === 'Retirado') return `${node} fue ocultado del Roadmap.`;
  if (known === 'Retirado')
    return current === 'Bloqueado'
      ? `${node} volvió a mostrarse en el Roadmap, pero está bloqueado.`
      : `${node} volvió a mostrarse en el Roadmap.`;
  return current === 'Bloqueado' ? `${node} fue bloqueado.` : `${node} fue desbloqueado.`;
}
