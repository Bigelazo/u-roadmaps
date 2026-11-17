import { expect, test } from 'vitest';
import { lineageLanes, type LineageEdition } from '@/features/roadmap/ui/version-lineage';

const copy = (year: number, semester: number) => ({ kind: 'COPY' as const, year, semester });
const empty = { kind: 'EMPTY' as const };
const edition = (year: number, semester: number, origin: LineageEdition['origin']) => ({
  year,
  semester,
  origin,
});

test('a linear lineage stays in one lane', () => {
  const { rows, laneCount } = lineageLanes([
    edition(2026, 1, copy(2025, 2)),
    edition(2025, 2, copy(2025, 1)),
    edition(2025, 1, empty),
  ]);
  expect(laneCount).toBe(1);
  expect(rows.map(({ lane, continues }) => [lane, continues])).toEqual([
    [0, true],
    [0, true],
    [0, false],
  ]);
  expect(rows[1].incoming).toEqual([0]);
});

test('autumn and spring lineages run in parallel lanes', () => {
  const { rows, laneCount } = lineageLanes([
    edition(2026, 2, copy(2025, 2)),
    edition(2026, 1, copy(2025, 1)),
    edition(2025, 2, empty),
    edition(2025, 1, empty),
  ]);
  expect(laneCount).toBe(2);
  expect(rows.map(({ lane }) => lane)).toEqual([0, 1, 0, 1]);
  expect(rows[1].passing).toEqual([0]);
  expect(rows[2]).toMatchObject({ incoming: [0], passing: [1], continues: false });
  expect(rows[3]).toMatchObject({ incoming: [1], passing: [] });
});

test('two editions copied from the same source merge into it', () => {
  const { rows } = lineageLanes([
    edition(2026, 2, copy(2025, 2)),
    edition(2026, 1, copy(2025, 2)),
    edition(2025, 2, empty),
  ]);
  expect(rows[2]).toMatchObject({ lane: 0, incoming: [0, 1] });
});

test('a source outside the list starts no lane', () => {
  const { rows } = lineageLanes([edition(2026, 1, copy(2020, 1)), edition(2025, 2, empty)]);
  expect(rows[0].continues).toBe(false);
  expect(rows[1]).toMatchObject({ lane: 0, incoming: [] });
});
