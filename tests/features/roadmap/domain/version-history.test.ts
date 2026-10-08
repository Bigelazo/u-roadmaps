import { describe, expect, it } from 'vitest';
import {
  editionLabel,
  isWithinVersionHorizon,
  versionHistoryHorizon,
} from '@/features/roadmap/domain/version-history';

const teaching = (year: number, semester: number, isActive = true) => ({
  year,
  semester,
  role: 'TEACHER' as const,
  isActive,
});

describe('versionHistoryHorizon', () => {
  it('is the latest term with an active teaching-staff Participation', () => {
    expect(
      versionHistoryHorizon([teaching(2025, 2), teaching(2026, 1), teaching(2024, 1)]),
    ).toEqual({ year: 2026, semester: 1 });
  });

  it('ignores inactive and student Participations', () => {
    expect(
      versionHistoryHorizon([
        teaching(2025, 1),
        teaching(2026, 2, false),
        { year: 2027, semester: 1, role: 'STUDENT', isActive: true },
      ]),
    ).toEqual({ year: 2025, semester: 1 });
  });

  it('is absent without an active teaching-staff Participation', () => {
    expect(versionHistoryHorizon([teaching(2026, 1, false)])).toBeNull();
    expect(versionHistoryHorizon([])).toBeNull();
  });
});

describe('isWithinVersionHorizon', () => {
  const horizon = { year: 2026, semester: 1 };
  it('includes the horizon and earlier terms only', () => {
    expect(isWithinVersionHorizon({ year: 2026, semester: 1 }, horizon)).toBe(true);
    expect(isWithinVersionHorizon({ year: 2025, semester: 2 }, horizon)).toBe(true);
    expect(isWithinVersionHorizon({ year: 2026, semester: 2 }, horizon)).toBe(false);
    expect(isWithinVersionHorizon({ year: 2027, semester: 1 }, horizon)).toBe(false);
  });
});

it('labels an edition by its Academic term', () => {
  expect(editionLabel({ year: 2026, semester: 1 })).toBe('Edición 2026-1');
});
