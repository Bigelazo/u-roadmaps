export type NodeAccessState = 'Disponible' | 'Bloqueado' | 'Retirado';

export function nodeAccessState(isVisible: boolean, isAccessible: boolean): NodeAccessState {
  return !isVisible ? 'Retirado' : isAccessible ? 'Disponible' : 'Bloqueado';
}

export function nodeAccessChangeText(title: string, known: string, current: string) {
  return `«${title}»${nodeAccessChangePredicate(known, current)}`;
}

export function nodeAccessChangePredicate(known: string, current: string) {
  if (current === 'Retirado') return ' fue ocultado del Roadmap.';
  if (known === 'Retirado')
    return current === 'Bloqueado'
      ? ' volvió a mostrarse en el Roadmap, pero está bloqueado.'
      : ' volvió a mostrarse en el Roadmap.';
  return current === 'Bloqueado' ? ' fue bloqueado.' : ' fue desbloqueado.';
}
