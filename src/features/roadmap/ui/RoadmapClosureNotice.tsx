import { CalendarClock, Lock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { CHILE_TIME_ZONE } from '@/features/roadmap/domain/scheduled-unlock';
import { resolveRoadmapFreezeDate, roadmapClosureInstant } from '@/features/roadmap/domain/closure';
import type { RoadmapVersionHistory } from '@/features/roadmap/version-types';

const freezeDateFormat = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const closedAtFormat = new Intl.DateTimeFormat('es-CL', {
  timeZone: CHILE_TIME_ZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function RoadmapClosureNotice({
  history: { current, versions, latestOffering },
  now,
}: Readonly<{ history: RoadmapVersionHistory; now: Date }>) {
  if (current) {
    const freezeDate = resolveRoadmapFreezeDate(current, current.closesOn);
    const lastEditableDay = freezeDateFormat.format(new Date(`${freezeDate}T12:00:00.000Z`));
    const consequences =
      'se quitan los bloqueos docentes y los desbloqueos programados, y nadie puede volver a modificarlo, ni siquiera para marcar nodos como completados. Queda en este historial como versión de solo lectura, que se podrá copiar al crear el Roadmap de un próximo semestre.';
    if (roadmapClosureInstant(freezeDate) <= now)
      return (
        <Alert role="status" className="border-transparent bg-info-soft *:[svg]:text-info">
          <Lock aria-hidden="true" />
          <AlertTitle>El Roadmap de {current.edition} se está cerrando</AlertTitle>
          <AlertDescription>
            Su fecha de congelamiento fue el {lastEditableDay} y se cerrará en breve. Al cerrarse,{' '}
            {consequences}
          </AlertDescription>
        </Alert>
      );
    return (
      <Alert role="status" className="border-transparent bg-info-soft *:[svg]:text-info">
        <CalendarClock aria-hidden="true" />
        <AlertTitle>
          El Roadmap de {current.edition} se puede modificar hasta el {lastEditableDay}
        </AlertTitle>
        <AlertDescription>
          <p>
            A las 00:00 del día siguiente (hora de Chile) se cierra de forma definitiva:{' '}
            {consequences}
          </p>
          {current.closesOn ? null : (
            <p>
              Es una fecha provisoria: el calendario académico oficial aún no publica el último día
              de exámenes del semestre.
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  }
  const closedLatest = versions.find(
    ({ year, semester }) => year === latestOffering?.year && semester === latestOffering.semester,
  );
  if (!closedLatest) return null;
  return (
    <Alert role="status" className="border-transparent bg-info-soft *:[svg]:text-info">
      <Lock aria-hidden="true" />
      <AlertTitle>
        El Roadmap de {closedLatest.edition} se cerró el{' '}
        {closedAtFormat.format(new Date(closedLatest.closedAt))}
      </AlertTitle>
      <AlertDescription>
        Ya nadie puede modificarlo. Quedó en este historial como versión de solo lectura, que se
        podrá copiar al crear el Roadmap de un próximo semestre.
      </AlertDescription>
    </Alert>
  );
}
