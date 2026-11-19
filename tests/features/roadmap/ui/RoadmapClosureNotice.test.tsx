import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { RoadmapClosureNotice } from '@/features/roadmap/ui/RoadmapClosureNotice';
import type { RoadmapVersionHistory } from '@/features/roadmap/version-types';

const latestOffering = { year: 2026, semester: 2, hasRoadmap: true };

function history(overrides: Partial<RoadmapVersionHistory>): RoadmapVersionHistory {
  return {
    course: { code: 'CC1002', name: 'Introducción a la Programación' },
    horizon: { year: 2026, semester: 2 },
    latestOffering,
    current: null,
    versions: [],
    ...overrides,
  } as RoadmapVersionHistory;
}

function current(closesOn: string | null) {
  return {
    year: 2026,
    semester: 2,
    edition: 'Primavera 2026',
    origin: { kind: 'EMPTY' as const },
    nodeCount: 3,
    closesOn,
  };
}

function noticeText(view: RoadmapVersionHistory, now: string) {
  return new DOMParser().parseFromString(
    renderToStaticMarkup(<RoadmapClosureNotice history={view} now={new Date(now)} />),
    'text/html',
  ).body.textContent;
}

test('announces the published freeze date as the last editable day before closure', () => {
  const text = noticeText(history({ current: current('2026-12-12') }), '2026-11-19T12:00:00Z');

  expect(text).toContain('se puede modificar hasta el sábado, 12 de diciembre de 2026');
  expect(text).toContain('A las 00:00 del día siguiente (hora de Chile)');
  expect(text).toContain('versión de solo lectura');
  expect(text).not.toContain('provisoria');
});

test('falls back to 20 January as a provisional freeze date when the calendar has none', () => {
  const text = noticeText(history({ current: current(null) }), '2026-11-19T12:00:00Z');

  expect(text).toContain('hasta el miércoles, 20 de enero de 2027');
  expect(text).toContain('Es una fecha provisoria');
});

test('reports a pending closure once the freeze date has passed', () => {
  const text = noticeText(history({ current: current('2026-11-18') }), '2026-11-19T12:00:00Z');

  expect(text).toContain('se está cerrando');
  expect(text).toContain('fue el miércoles, 18 de noviembre de 2026');
});

test('reports when the latest offering roadmap was already closed', () => {
  const text = noticeText(
    history({
      versions: [
        {
          year: 2026,
          semester: 2,
          edition: 'Primavera 2026',
          closedAt: '2026-11-19T03:00:00.000Z',
          nodeCount: 3,
          creator: null,
          teachingStaff: [],
          origin: { kind: 'EMPTY' },
        },
      ],
    }),
    '2026-11-19T12:00:00Z',
  );

  expect(text).toContain('El Roadmap de Primavera 2026 se cerró el 19 de noviembre de 2026');
});

test('shows nothing when the latest offering has no roadmap', () => {
  expect(noticeText(history({}), '2026-11-19T12:00:00Z')).toBe('');
});
