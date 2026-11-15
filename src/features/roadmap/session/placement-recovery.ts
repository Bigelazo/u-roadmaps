export const uncertainCreationMessage =
  'No se pudo confirmar si el nodo se creó. Tu borrador se mantiene. Reenvía la misma creación para comprobarla sin duplicarla.';

export class UncertainNodeCreationError extends Error {
  constructor() {
    super(uncertainCreationMessage);
    this.name = 'UncertainNodeCreationError';
  }
}

export type PlacementRecovery = {
  readonly kind: 'unsynchronized' | 'uncertain-creation' | 'recovered-creation';
  readonly message: string;
};
