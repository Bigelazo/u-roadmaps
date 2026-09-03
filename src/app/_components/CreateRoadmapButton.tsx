'use client';

// App-level composition for the academic overview's Roadmap creation action.

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { roadmapUrl } from '@/features/roadmap';
import { Button } from '@/shared/ui/button';

type Props = Readonly<{ courseCode: string; year: number; semester: number; courseName: string }>;

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

export default function CreateRoadmapButton({ courseCode, year, semester, courseName }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isNavigating, startNavigation] = useTransition();
  const router = useRouter();
  const identifier = { courseCode, year, semester };

  async function createRoadmap() {
    setError(null);
    setIsCreating(true);
    const response = await fetch(roadmapUrl(identifier), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => null);
    if (!response?.ok) {
      setError(response ? await creationError(response) : 'No se pudo crear el roadmap.');
      setIsCreating(false);
      return;
    }
    startNavigation(() => {
      router.push(`/courses/${encodeURIComponent(courseCode)}/${year}/${semester}`);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        aria-label={`Crear roadmap de ${courseName}`}
        disabled={isCreating || isNavigating}
        onClick={createRoadmap}
        size="lg"
        type="button"
      >
        <Plus aria-hidden="true" size={16} />
        {isCreating || isNavigating ? 'Creando roadmap' : 'Crear roadmap'}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
