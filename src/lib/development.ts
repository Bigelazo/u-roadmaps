import { developmentEnvironmentEnabled } from '@/shared/server/environment/development';
import { developmentPersonas } from '@/lib/development-fixtures';

export { developmentPersonas };

export function isDevelopmentPersona(userId: string) {
  return (
    developmentEnvironmentEnabled() && developmentPersonas.some((persona) => persona.id === userId)
  );
}
