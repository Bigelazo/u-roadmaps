'use client';

import { useId, useState } from 'react';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import type { CourseMember } from '@/features/roadmap/course-participants-types';

function searchable(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, ' ')
    .toLocaleLowerCase('es')
    .trim();
}

export function StudentRoster({
  students,
  hasRoadmap,
  visibleNodes,
}: Readonly<{ students: readonly CourseMember[]; hasRoadmap: boolean; visibleNodes: number }>) {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const filter = searchable(query);
  const matches = students.filter((member) =>
    filter.split(/\s+/).every((term) => searchable(member.name).includes(term)),
  );
  const hasSections = students.some((member) => member.sections.length > 0);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full sm:max-w-xs">
          <label className="sr-only" htmlFor={searchId}>
            Buscar estudiante por nombre
          </label>
          <Input
            className="h-11"
            id={searchId}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar estudiante por nombre…"
            type="search"
            value={query}
          />
        </div>
        <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
          {filter
            ? `${matches.length} de ${students.length} personas`
            : `${students.length} personas`}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-fog bg-card">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">
            Estudiantes del curso{hasRoadmap ? ' y avance en el roadmap' : ''}
          </caption>
          <thead className="border-b border-fog bg-cloud text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium sm:px-5" scope="col">
                Nombre
              </th>
              {hasSections ? (
                <th className="hidden w-24 px-3 py-3 font-medium md:table-cell" scope="col">
                  Sección
                </th>
              ) : null}
              {hasRoadmap ? (
                <>
                  <th className="w-[40%] px-4 py-3 font-medium sm:w-[34%] sm:px-5" scope="col">
                    Avance
                  </th>
                  <th
                    className="hidden w-28 py-3 pr-5 text-right font-medium sm:table-cell"
                    scope="col"
                  >
                    Nodos
                  </th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-fog">
            {matches.map((member) => (
              <tr aria-label={member.name} className="hover:bg-cloud/60" key={member.key}>
                <th className="px-4 py-3 text-left align-middle font-medium sm:px-5" scope="row">
                  <span className="break-words">{member.name}</span>
                  {member.institutionalPosition === 'OBSERVER' ||
                  !member.hasEntered ||
                  (hasSections && member.sections.length > 0) ? (
                    <div
                      className={
                        member.institutionalPosition === 'OBSERVER' || !member.hasEntered
                          ? 'mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs font-normal text-muted-foreground'
                          : 'mt-1 text-xs font-normal text-muted-foreground md:hidden'
                      }
                    >
                      {member.institutionalPosition === 'OBSERVER' ? (
                        <span>Oyente · fuera del promedio</span>
                      ) : null}
                      {!member.hasEntered ? <span>Sin ingreso</span> : null}
                      {member.sections.length > 0 ? (
                        <span className="md:hidden">
                          {member.sections.length === 1 ? 'Sección' : 'Secciones'}{' '}
                          {member.sections.join(', ')}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </th>
                {hasSections ? (
                  <td className="hidden px-3 py-3 align-middle text-muted-foreground tabular-nums md:table-cell">
                    {member.sections.join(', ') || '—'}
                  </td>
                ) : null}
                {hasRoadmap ? (
                  <>
                    <td className="px-4 py-3 align-middle sm:px-5">
                      {member.completion !== null ? (
                        <>
                          <div className="flex items-center gap-3">
                            <span className="w-10 shrink-0 text-right font-semibold tabular-nums">
                              {Math.round(member.completion * 100)}%
                            </span>
                            <div
                              aria-label={`Completación de ${member.name}`}
                              aria-valuemax={100}
                              aria-valuemin={0}
                              aria-valuenow={Math.round(member.completion * 100)}
                              className="h-1.5 flex-1 overflow-hidden rounded-full bg-fog"
                              role="progressbar"
                            >
                              <div
                                className="h-full rounded-full bg-progress"
                                style={{ width: `${Math.round(member.completion * 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className="mt-1 block text-right text-xs text-muted-foreground tabular-nums sm:sr-only">
                            {member.completedNodes} de {visibleNodes} nodos
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin nodos visibles</span>
                      )}
                    </td>
                    <td className="hidden py-3 pr-5 text-right align-middle text-muted-foreground tabular-nums sm:table-cell">
                      {member.completion !== null ? (
                        <>
                          {member.completedNodes} / {visibleNodes}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {matches.length === 0 ? (
          <div className="grid justify-items-center gap-3 px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {students.length === 0
                ? 'No hay estudiantes para mostrar'
                : 'No encontramos estudiantes con ese nombre.'}
            </p>
            {filter ? (
              <Button onClick={() => setQuery('')} variant="outline">
                Limpiar búsqueda
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
