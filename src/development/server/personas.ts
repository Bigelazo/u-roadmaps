import { developmentEnvironmentEnabled } from '@/shared/server/environment/development';
import { developmentPersonas } from '../fixtures/catalog';

export function isDevelopmentPersona(userId: string) {
  return (
    developmentEnvironmentEnabled() && developmentPersonas.some((persona) => persona.id === userId)
  );
}
