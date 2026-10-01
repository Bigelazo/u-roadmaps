import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

const { notification } = vi.hoisted(() => ({
  notification: {
    id: 'path-notice',
    subject: 'Ruta actualizada',
    body: 'Docente A actualizó la ruta: «Evaluación 1» ahora requiere «Leyes de Newton».',
    data: {
      courseCode: 'CC3002',
      year: 2026,
      semester: 2,
      changeKind: 'dependency-added',
      targetKind: 'roadmap',
      nodeId: 'node-a',
      occurredAt: '2026-09-30T15:00:00.000Z',
      eventCount: 1,
      actorName: 'Docente A',
    },
  },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/features/notifications/components/NotificationsInbox', () => ({
  useSelectedNotification: () => ({ notification }),
}));

import { RoadmapAvailabilityDialog } from '@/features/notifications/components/RoadmapAvailabilityDialog';

beforeEach(() => {
  notification.id = 'path-notice';
  notification.subject = 'Ruta actualizada';
  notification.body =
    'Docente A actualizó la ruta: «Evaluación 1» ahora requiere «Leyes de Newton».';
  notification.data.changeKind = 'dependency-added';
  notification.data.targetKind = 'roadmap';
  notification.data.nodeId = 'node-a';
  notification.data.actorName = 'Docente A';
  notification.data.occurredAt = '2026-09-30T15:00:00.000Z';
  notification.data.eventCount = 1;
});

test('shows the delivered Dependency message instead of Roadmap availability copy', () => {
  render(
    <RoadmapAvailabilityDialog
      noticeId="path-notice"
      courseCode="CC3002"
      year={2026}
      semester={2}
      courseName="Mecánica"
    />,
  );

  expect(screen.getByRole('heading', { name: 'Ruta actualizada' })).toBeTruthy();
  expect(
    screen.getByText(
      'Docente A actualizó la ruta: «Evaluación 1» ahora requiere «Leyes de Newton».',
    ),
  ).toBeTruthy();
  expect(
    screen.queryByText('Se creó el Roadmap de Mecánica para que puedas comenzar a recorrerlo.'),
  ).toBeNull();
});

test('shows both names in the Roadmap-level classification change dialog', () => {
  notification.id = 'classification-notice';
  notification.subject = 'Tipo «Lectura» → «Lecturas guiadas»';
  notification.body = 'Docente A actualizó la clasificación del Roadmap de CC3002.';
  notification.data.changeKind = 'classification-updated';

  render(
    <RoadmapAvailabilityDialog
      noticeId="classification-notice"
      courseCode="CC3002"
      year={2026}
      semester={2}
      courseName="Mecánica"
    />,
  );

  expect(screen.getByRole('heading', { name: 'Tipo «Lectura» → «Lecturas guiadas»' })).toBeTruthy();
  expect(
    screen.getByText('Docente A actualizó la clasificación del Roadmap de CC3002.'),
  ).toBeTruthy();
  expect(screen.getByText('Docente A')).toBeTruthy();
});

test('shows only the projected content and latest-change labels for a Digest summary', () => {
  notification.id = 'node-summary';
  notification.subject = 'Resumen de cambios · Nodo «Unidad 1»';
  notification.body =
    'Se agruparon 2 cambios. Último cambio: Nodo bloqueado: Luis Soto bloqueó Unidad 1.';
  notification.data.changeKind = 'node-blocked';
  notification.data.targetKind = 'node';
  notification.data.nodeId = 'node-a';
  notification.data.eventCount = 2;
  notification.data.actorName = 'Luis Soto';
  notification.data.occurredAt = '2026-09-30T15:00:04.000Z';

  render(
    <RoadmapAvailabilityDialog
      noticeId="node-summary"
      courseCode="CC3002"
      year={2026}
      semester={2}
      courseName="Mecánica"
    />,
  );

  expect(screen.getByRole('heading', { name: notification.subject })).toBeTruthy();
  expect(screen.getByText(notification.body)).toBeTruthy();
  expect(screen.getByText('2 cambios')).toBeTruthy();
  expect(screen.getByText('Cambios agrupados')).toBeTruthy();
  expect(screen.getByText('Autor del último cambio')).toBeTruthy();
  expect(screen.getByText('Último cambio')).toBeTruthy();
  expect(screen.queryByText('Cronología completa')).toBeNull();
});
