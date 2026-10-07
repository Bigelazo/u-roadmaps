export function UnavailableNoticeFallback({
  reason,
}: {
  reason: 'course-unavailable' | 'roadmap-unavailable';
}) {
  return (
    <div className="mx-auto mt-6 w-full max-w-3xl rounded-lg border bg-card p-4" role="status">
      <p className="font-semibold">No se puede abrir este Roadmap</p>
      <p className="text-sm text-muted-foreground">
        {reason === 'course-unavailable'
          ? 'Tu Participación ya no tiene acceso a este Curso. Puedes revisar tus Cursos en el Resumen académico.'
          : 'Este Roadmap ya no está disponible. Puedes revisar tus Cursos en el Resumen académico.'}
      </p>
    </div>
  );
}
