import { describe, expect, it } from 'vitest';
import { academicWeekLabel } from '@/features/academic-overview/domain/academic-week';

const spring2026 = {
  classStartDay: '2026-08-03',
  lastClassDay: '2026-11-28',
  examStartDay: '2026-11-30',
  examEndDay: '2026-12-12',
  recesses: [
    { start: '2026-09-14', end: '2026-09-20' },
    { start: '2026-10-26', end: '2026-11-01' },
  ],
};

describe('academic week label', () => {
  it.each([
    ['2026-08-02', null],
    ['2026-08-03', 'Semana 1'],
    ['2026-08-09', 'Semana 1'],
    ['2026-08-10', 'Semana 2'],
    ['2026-09-13', 'Semana 6'],
    ['2026-09-16', 'Semana de receso 1'],
    ['2026-09-21', 'Semana 7'],
    ['2026-10-28', 'Semana de receso 2'],
    ['2026-11-02', 'Semana 12'],
    ['2026-11-28', 'Semana 15'],
    ['2026-11-30', 'Semana de Exámenes 1'],
    ['2026-12-12', 'Semana de Exámenes 2'],
    ['2026-12-13', null],
  ])('on %s shows %s', (today, label) => {
    expect(academicWeekLabel(spring2026, today)).toBe(label);
  });
});
