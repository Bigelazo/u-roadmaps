export function UnavailableNoticeFallback({
  reason,
}: {
  reason: 'course-unavailable' | 'roadmap-unavailable';
}) {
  return (
    <Alert className="mx-auto mt-6 max-w-3xl" role="status">
      <AlertTitle>No se puede abrir este Roadmap</AlertTitle>
      <AlertDescription>
        {reason === 'course-unavailable'
          ? 'Tu Participación ya no tiene acceso a este Curso. Puedes revisar tus Cursos en el Resumen académico.'
          : 'Este Roadmap ya no está disponible. Puedes revisar tus Cursos en el Resumen académico.'}
      </AlertDescription>
    </Alert>
  );
}
import { Alert, AlertTitle, AlertDescription } from '@/shared/ui/alert';
