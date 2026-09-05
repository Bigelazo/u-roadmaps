import { describe, expect, it } from 'vitest';
import {
  extractAcademicTermDates,
  fetchPublishedAcademicTerm,
  selectTermCalendarPdf,
} from '@/integrations/academic-calendar/server';

const calendarPage = `
  <h3>Calendario Semestre Primavera 2026</h3>
  <ul><li><a href="/dam/primavera-2026.pdf">Calendario Semestre Primavera</a></li></ul>
  <h3>Calendario Semestre Otoño 2026</h3>
  <ul><li><a href="/dam/otono-2026.pdf">Calendario Semestre Otoño 2026</a></li></ul>
`;

describe('academic calendar', () => {
  it('selects the PDF from the requested term section, regardless of page order', () => {
    expect(selectTermCalendarPdf(calendarPage, { year: 2026, semester: 1 })).toBe(
      'https://ingenieria.uchile.cl/dam/otono-2026.pdf',
    );
  });

  it('extracts the main semester end dates, before appended summer dates', () => {
    expect(
      extractAcademicTermDates(`
        28/11/2026 ÚLTIMO DÍA DE CLASES
        30/11- 12/12/2026 EXÁMENES
        PERIODO DE VERANO 2026-2027
        23/01/2027 ÚLTIMO DÍA DE CLASES
        25/01-30/01/2027 EXÁMENES
      `),
    ).toEqual({
      lastClassDay: '2026-11-28',
      examStartDay: '2026-11-30',
      examEndDay: '2026-12-12',
      roadmapFreezeDate: '2026-12-12',
    });
  });

  it('downloads, parses, and records official source URLs', async () => {
    const result = await fetchPublishedAcademicTerm(
      { year: 2026, semester: 2 },
      {
        fetcher: async (input) => {
          const url = input.toString();
          return url.endsWith('/calendarios')
            ? new Response(calendarPage)
            : new Response(new Uint8Array([1, 2, 3]));
        },
        extractText: async () => '28/11/2026 ÚLTIMO DÍA DE CLASES\n30/11- 12/12/2026 EXÁMENES',
      },
    );

    expect(result).toMatchObject({
      year: 2026,
      semester: 2,
      sourcePdfUrl: 'https://ingenieria.uchile.cl/dam/primavera-2026.pdf',
      roadmapFreezeDate: '2026-12-12',
    });
  });
});
