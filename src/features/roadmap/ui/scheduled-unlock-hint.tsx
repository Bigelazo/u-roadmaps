import type { ReactNode } from 'react';

export function scheduledUnlockPrerequisiteHint(blockedPrerequisites: number): ReactNode {
  if (blockedPrerequisites === 0)
    return (
      <>
        Si a esa hora algún prerrequisito sigue bloqueado, este nodo{' '}
        <strong className="font-semibold text-foreground">no</strong> será desbloqueado.
      </>
    );
  return blockedPrerequisites === 1
    ? 'Su prerrequisito bloqueado también se desbloqueará a esa hora.'
    : `Sus ${blockedPrerequisites} prerrequisitos bloqueados también se desbloquearán a esa hora.`;
}
