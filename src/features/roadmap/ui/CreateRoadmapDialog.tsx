'use client';


import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import { roadmapUrl, versionUrl } from '@/features/roadmap/client';
import { creatorLabel, originLabel } from '@/features/roadmap/ui/version-labels';
import { versionHistoryApiUrl } from '@/shared/version-history-url';
import type { RoadmapVersionHistory } from '@/features/roadmap/version-types';
import { Button } from '@/shared/ui/button';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import { Field, FieldLabel, FieldLegend, FieldSet } from '@/shared/ui/field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';

type Props = Readonly<{ courseCode: string; year: number; semester: number; courseName: string }>;
type Version = RoadmapVersionHistory['versions'][number];

const termKey = ({ year, semester }: Version) => `${year}-${semester}`;

async function creationError(response: Response) {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'message' in body.error &&
      typeof body.error.message === 'string'
    )
      return body.error.message;
  } catch {
    // La respuesta sin cuerpo JSON cae al mensaje genérico.
  }
  return 'No se pudo crear el roadmap.';
}

async function frozenVersions(courseCode: string): Promise<Version[] | null> {
  const response = await fetch(versionHistoryApiUrl(courseCode)).catch(() => null);
  if (!response?.ok) return null;
  const history = (await response.json()) as RoadmapVersionHistory;
  return history.versions;
}

export function CreateRoadmapDialog({ courseCode, year, semester, courseName }: Props) {
  const originId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [source, setSource] = useState<string>('empty');
  const [isNavigating, startNavigation] = useTransition();
  const router = useRouter();
  const identifier = { courseCode, year, semester };
  const busy = isCreating || isNavigating;

  async function openChanged(open: boolean) {
    if (!open) return;
    setError(null);
    setSource('empty');
    setVersions(null);
    setHistoryFailed(false);
    const loaded = await frozenVersions(courseCode);
    setHistoryFailed(loaded === null);
    setVersions(loaded ?? []);
  }

  async function createRoadmap() {
    setError(null);
    setIsCreating(true);
    const version = versions?.find((candidate) => termKey(candidate) === source);
    const response = await fetch(roadmapUrl(identifier), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        version ? { source: { year: version.year, semester: version.semester } } : {},
      ),
    }).catch(() => null);
    if (!response?.ok) {
      setError(response ? await creationError(response) : 'No se pudo crear el roadmap.');
      setIsCreating(false);
      return;
    }
    startNavigation(() => {
      router.push(`/courses/${encodeURIComponent(courseCode)}/${year}/${semester}?created=1`);
    });
  }

  return (
    <Dialog onOpenChange={openChanged}>
      <DialogTrigger
        render={<Button aria-label={`Crear roadmap de ${courseName}`} size="lg" type="button" />}
      >
        <Plus aria-hidden="true" size={16} />
        Crear roadmap
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear roadmap de {courseName}</DialogTitle>
          <DialogDescription>
            Empieza con un roadmap vacío o copia una versión anterior del ramo.
          </DialogDescription>
        </DialogHeader>
        <FieldSet className="grid max-h-[50vh] gap-2 overflow-y-auto" disabled={busy}>
          <FieldLegend id={originId} className="sr-only">
            Origen del roadmap
          </FieldLegend>
          <RadioGroup
            aria-labelledby={originId}
            name="roadmap-source"
            value={source}
            disabled={busy}
            onValueChange={(value) => {
              if (typeof value === 'string') setSource(value);
            }}
          >
            <Field
              orientation="horizontal"
              data-disabled={busy}
              className="rounded-lg border border-fog px-3 py-2"
            >
              <RadioGroupItem id={`${originId}-empty`} value="empty" disabled={busy} />
              <FieldLabel htmlFor={`${originId}-empty`} className="min-h-11 flex-1 items-center">
                Roadmap vacío
              </FieldLabel>
            </Field>
            {versions === null ? (
              <p className="text-sm text-muted-foreground" role="status">
                Buscando versiones anteriores…
              </p>
            ) : versions.length > 0 ? (
              <>
                <p className="mt-2 text-sm font-semibold">Desde una versión anterior</p>
                {versions.map((version) => (
                  <Field
                    orientation="horizontal"
                    data-disabled={busy}
                    className="rounded-lg border border-fog px-3 py-2"
                    key={termKey(version)}
                  >
                    <RadioGroupItem
                      id={`${originId}-${termKey(version)}`}
                      value={termKey(version)}
                      disabled={busy}
                    />
                    <FieldLabel
                      htmlFor={`${originId}-${termKey(version)}`}
                      className="min-h-11 min-w-0 flex-1 items-center"
                    >
                      <span className="grid min-w-0">
                        <span className="font-medium">{version.edition}</span>
                        <span className="text-xs text-muted-foreground">
                          {creatorLabel(version.creator)} · {originLabel(version.origin)}
                        </span>
                      </span>
                    </FieldLabel>
                    <a
                      aria-label={`Ver ${version.edition}`}
                      className="flex items-center gap-1 text-sm underline underline-offset-3"
                      href={versionUrl({ courseCode, ...version })}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Ver <ExternalLink aria-hidden="true" size={14} />
                    </a>
                  </Field>
                ))}
              </>
            ) : null}
            {historyFailed ? (
              <p className="text-sm text-destructive" role="alert">
                No se pudieron cargar las versiones anteriores. Puedes crear un roadmap vacío.
              </p>
            ) : null}
          </RadioGroup>
        </FieldSet>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button disabled={busy || versions === null} onClick={createRoadmap} type="button">
            {busy ? 'Creando roadmap' : 'Crear roadmap'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
