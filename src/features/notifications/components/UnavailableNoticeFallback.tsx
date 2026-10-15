export function UnavailableNoticeFallback({
  reason,
}: {
  reason: 'course-unavailable' | 'roadmap-unavailable';
}) {
  return (
    <Alert role="status">
      <AlertTitle>No se puede abrir ese roadmap</AlertTitle>
      <AlertDescription>
        {reason === 'course-unavailable'
          ? 'Ya no tienes acceso a ese curso. Aquí están los cursos en los que participas hoy.'
          : 'Ese roadmap ya no está disponible. Aquí están los cursos en los que participas hoy.'}
      </AlertDescription>
    </Alert>
  );
}
import { Alert, AlertTitle, AlertDescription } from '@/shared/ui/alert';
