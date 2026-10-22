export const NODE_ACCESS_STATES = ['Disponible', 'Bloqueado', 'Retirado'] as const;
export type NodeAccessState = (typeof NODE_ACCESS_STATES)[number];

export function nodeAccessState(isVisible: boolean, isAccessible: boolean): NodeAccessState {
  return !isVisible ? 'Retirado' : isAccessible ? 'Disponible' : 'Bloqueado';
}

export function nodeAccessChangeText(title: string, known: string, current: string) {
  const node = `«${title}»`;
  if (current === 'Retirado') return `${node} fue ocultado del Roadmap.`;
  if (known === 'Retirado')
    return current === 'Bloqueado'
      ? `${node} volvió a mostrarse en el Roadmap, pero está bloqueado.`
      : `${node} volvió a mostrarse en el Roadmap.`;
  return current === 'Bloqueado' ? `${node} fue bloqueado.` : `${node} fue desbloqueado.`;
}
