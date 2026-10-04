import { expect, test } from 'vitest';
import digestExamples from './fixtures/digest-examples.json';
import { projectDigestNotification } from '@/features/notifications/digest-projection';

const firstChange = {
  roadmapId: 'roadmap-a',
  courseCode: 'CC1001',
  year: 2026,
  semester: 2,
  targetKind: 'node',
  nodeId: 'node-a',
  nodeTitle: 'Unidad 1',
  changeKind: 'node-updated',
  occurredAt: '2026-09-30T12:00:00.000Z',
  eventCount: 1,
  actorName: 'Ana Pérez',
  noticeTitle: 'Unidad 1',
  noticeBody: 'Nodo actualizado: Ana Pérez actualizó Unidad 1.',
  digestKey: 'roadmap:roadmap-a:node:node-a',
};

test('keeps a first delivery immediate and projects exactly the supported scalar data', () => {
  const result = projectDigestNotification(firstChange, []);

  expect(result).toEqual({
    subject: 'Unidad 1',
    body: 'Nodo actualizado: Ana Pérez actualizó Unidad 1.',
    data: {
      roadmapId: 'roadmap-a',
      courseCode: 'CC1001',
      year: 2026,
      semester: 2,
      targetKind: 'node',
      nodeId: 'node-a',
      changeKind: 'node-updated',
      occurredAt: '2026-09-30T12:00:00.000Z',
      eventCount: 1,
      actorName: 'Ana Pérez',
    },
  });
});

test('preserves the existing immediate subject and body for general and Resource notices', () => {
  const availability = projectDigestNotification(
    {
      roadmapId: 'roadmap-a',
      courseCode: 'CC1001',
      year: 2026,
      semester: 2,
      targetKind: 'roadmap',
      changeKind: 'roadmap-available',
      occurredAt: '2026-09-30T12:00:00.000Z',
      eventCount: 1,
      actorName: 'Ana Pérez',
      digestKey: 'roadmap:roadmap-a:general',
    },
    [],
  );
  const resource = projectDigestNotification(
    {
      ...firstChange,
      changeKind: 'resource-added',
      resourceTitle: 'Guía de ejercicios',
      noticeTitle: 'Cambio de recurso: Guía de ejercicios',
      noticeBody: 'Ana Pérez modificó un recurso en un Nodo del Roadmap de CC1001.',
    },
    [],
  );

  expect(availability).toMatchObject({
    subject: 'Roadmap disponible: CC1001',
    body: 'Ana Pérez creó el roadmap de CC1001.',
  });
  expect(resource).toMatchObject({
    subject: 'Cambio de recurso: Guía de ejercicios',
    body: 'Ana Pérez modificó un recurso en un Nodo del Roadmap de CC1001.',
  });
});

test('projects a repeated-event summary from the latest effective change only', () => {
  const earlier = {
    ...firstChange,
    occurredAt: '2026-09-30T12:00:01.000Z',
    actorName: 'Ana Pérez',
    noticeBody: 'Nodo actualizado: Ana Pérez actualizó Unidad 1.',
  };
  const latest = {
    ...firstChange,
    changeKind: 'node-blocked',
    occurredAt: '2026-09-30T12:00:04.000Z',
    actorName: 'Luis Soto',
    noticeBody: 'Nodo bloqueado: Luis Soto bloqueó Unidad 1.',
  };

  const result = projectDigestNotification(latest, [
    { id: 'newer', time: '2026-09-30T12:00:04.000Z', payload: latest },
    { id: 'older', time: '2026-09-30T12:00:01.000Z', payload: earlier },
  ]);

  expect(result.subject).toBe('Resumen de cambios · Nodo «Unidad 1»');
  expect(result.body).toContain('2 cambios');
  expect(result.body).toContain(latest.noticeBody);
  expect(result.body).not.toContain(earlier.noticeBody);
  expect(result.data).toEqual({
    roadmapId: 'roadmap-a',
    courseCode: 'CC1001',
    year: 2026,
    semester: 2,
    targetKind: 'node',
    nodeId: 'node-a',
    changeKind: 'node-blocked',
    occurredAt: '2026-09-30T12:00:04.000Z',
    eventCount: 2,
    actorName: 'Luis Soto',
  });
  expect(Object.keys(result.data)).toHaveLength(10);
});

test('keeps a one-event Digest summary distinct from the immediate first delivery', () => {
  const result = projectDigestNotification(firstChange, [
    { id: 'repeat', time: firstChange.occurredAt, payload: firstChange },
  ]);

  expect(result.subject).toBe('Resumen de cambios · Nodo «Unidad 1»');
  expect(result.body).toContain('Se agruparon 1 cambio.');
  expect(result.data.eventCount).toBe(1);
});

test('keeps Roadmap summaries general and rejects an invalid effective timestamp', () => {
  const general = {
    ...firstChange,
    targetKind: 'roadmap',
    nodeId: undefined,
    nodeTitle: undefined,
    digestKey: 'roadmap:roadmap-a:general',
    changeKind: 'dependency-added',
    noticeTitle: 'Ruta actualizada',
    noticeBody: 'Se añadió un prerrequisito.',
  };
  const result = projectDigestNotification(general, [
    { id: 'general', time: '2026-09-30T12:00:00.000Z', payload: general },
  ]);

  expect(result.subject).toBe('Resumen de cambios · Roadmap de CC1001');
  expect(result.data).not.toHaveProperty('nodeId');
  expect(result.data.eventCount).toBe(1);
  expect(() => projectDigestNotification({ ...firstChange, occurredAt: 'not-a-date' }, [])).toThrow(
    'occurredAt',
  );
});

test('includes the latest classification transition in a Roadmap summary', () => {
  const classification = {
    ...firstChange,
    targetKind: 'roadmap',
    nodeId: undefined,
    nodeTitle: undefined,
    digestKey: 'roadmap:roadmap-a:general',
    changeKind: 'classification-updated',
    actorName: 'Luis Soto',
    noticeTitle: 'Tipo «Lectura» → «Material guiado»',
    noticeBody: 'Luis Soto actualizó la clasificación del Roadmap de CC1001.',
  };
  const result = projectDigestNotification(classification, [
    { id: 'classification-repeat', time: classification.occurredAt, payload: classification },
  ]);

  expect(result.body).toBe(
    'Se agruparon 1 cambio. Último cambio: Luis Soto actualizó la clasificación del Roadmap de CC1001: Tipo «Lectura» → «Material guiado».',
  );
});

test('preserves full own notice messages and contextual strings', () => {
  const result = projectDigestNotification(
    {
      ...firstChange,
      nodeTitle: 'T'.repeat(300),
      actorName: 'A'.repeat(300),
      noticeTitle: 'S'.repeat(300),
      noticeBody: 'B'.repeat(300),
    },
    [],
  );
  expect(result.subject).toBe('S'.repeat(300));
  expect(result.body).toBe('B'.repeat(300));
  expect(result.data.actorName).toBe('A'.repeat(300));
});

for (const example of digestExamples.cases) {
  test(`reproduces the documented ${example.noticeClass} summary projection`, () => {
    expect(projectDigestNotification(example.payload, example.digestEvents)).toEqual(
      example.expectedProjection,
    );
  });
}
