import { describe, expect, it } from 'vitest';
import {
  currentAcademicTerm,
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
  it.each([
    ['2026-07-31T12:00:00.000Z', { year: 2026, semester: 1 }],
    ['2026-08-01T12:00:00.000Z', { year: 2026, semester: 2 }],
    ['2027-01-01T02:00:00.000Z', { year: 2026, semester: 2 }],
    ['2027-01-01T04:00:00.000Z', { year: 2027, semester: 1 }],
  ])('at %s the current term in Santiago is %o', (now, term) => {
    expect(currentAcademicTerm(new Date(now))).toEqual(term);
  });

  it('selects the PDF from the requested term section, regardless of page order', () => {
    expect(selectTermCalendarPdf(calendarPage, { year: 2026, semester: 1 })).toBe(
      'https://ingenieria.uchile.cl/dam/otono-2026.pdf',
    );
  });

  it('extracts the main semester end dates, before appended summer dates', () => {
    expect(
      extractAcademicTermDates(`
        03/08/2026 INICIO DE CLASES
        29/08 - 05/09/2026 SEMANA OLÍMPICA - Durante esta semana, no deberán realizarse actividades
        14/09 - 20/09/2026 1º RECESO ACADÉMICO FIESTAS PATRIAS
        26/10 - 01/11/2026 2° RECESO ACADÉMICO (válido para estudiantes nuevos/as y antiguos/as)
        28/11/2026 ÚLTIMO DÍA DE CLASES
        30/11- 12/12/2026 EXÁMENES
        PERIODO DE VERANO 2026-2027
        14/12/2026 INICIO DE CLASES
        23/01/2027 ÚLTIMO DÍA DE CLASES
        25/01-30/01/2027 EXÁMENES
      `),
    ).toEqual({
      classStartDay: '2026-08-03',
      recesses: [
        { start: '2026-09-14', end: '2026-09-20' },
        { start: '2026-10-26', end: '2026-11-01' },
      ],
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
        extractText: async () =>
          '03/08/2026 INICIO DE CLASES\n28/11/2026 ÚLTIMO DÍA DE CLASES\n30/11- 12/12/2026 EXÁMENES',
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
