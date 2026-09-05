import { PDFParse } from 'pdf-parse';

export const ACADEMIC_CALENDAR_PAGE_URL =
  'https://ingenieria.uchile.cl/escuela/pregrado/informacion-para-estudiantes/calendarios';

export type Semester = 1 | 2;

export type AcademicTermIdentifier = {
  year: number;
  semester: Semester;
};

export type AcademicTermDates = {
  lastClassDay: string;
  examStartDay: string;
  examEndDay: string;
  roadmapFreezeDate: string;
};

export type PublishedAcademicTerm = AcademicTermIdentifier &
  AcademicTermDates & {
    sourcePageUrl: string;
    sourcePdfUrl: string;
  };

type Fetcher = typeof fetch;

const termName: Record<Semester, string> = {
  1: 'otoño',
  2: 'primavera',
};

function normalizeText(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getHref(anchor: string) {
  const href = anchor.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  return href?.replace(/&amp;/gi, '&');
}

function isOfficialPdfUrl(url: URL) {
  return url.protocol === 'https:' && url.hostname === 'ingenieria.uchile.cl';
}

/** Finds the semester-specific PDF inside its heading section, never by page order. */
export function selectTermCalendarPdf(
  pageHtml: string,
  term: AcademicTermIdentifier,
  pageUrl = ACADEMIC_CALENDAR_PAGE_URL,
) {
  const name = termName[term.semester];
  const headingPattern = new RegExp(
    `<h[1-6][^>]*>[^<]*calendario[^<]*semestre[^<]*${escapeRegExp(name)}[^<]*${term.year}[^<]*</h[1-6]>`,
    'i',
  );
  const heading = headingPattern.exec(pageHtml);
  if (!heading || heading.index === undefined) {
    throw new Error(`No se encontró el calendario de ${name} ${term.year} en la página oficial.`);
  }

  const sectionEnd = pageHtml.slice(heading.index + heading[0].length).search(/<h[1-6][^>]*>/i);
  const section = pageHtml.slice(
    heading.index + heading[0].length,
    sectionEnd === -1 ? undefined : heading.index + heading[0].length + sectionEnd,
  );
  const anchors = section.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
  const calendarAnchor = anchors.find((anchor) =>
    /calendario\s+semestre/i.test(normalizeText(anchor)),
  );
  const href = calendarAnchor && getHref(calendarAnchor);
  if (!href) {
    throw new Error(`No se encontró el enlace al PDF de ${name} ${term.year}.`);
  }

  const pdfUrl = new URL(href, pageUrl);
  if (!isOfficialPdfUrl(pdfUrl)) {
    throw new Error(
      'El enlace del calendario no apunta al dominio oficial de Ingeniería U. de Chile.',
    );
  }
  return pdfUrl.toString();
}

function calendarDay(raw: string, inferredYear?: number) {
  const parts = raw.trim().split('/').map(Number);
  const [day, month, explicitYear] = parts;
  const year = explicitYear ?? inferredYear;
  const parsedDate = year ? new Date(Date.UTC(year, month - 1, day)) : undefined;
  if (
    !day ||
    !month ||
    !year ||
    day > 31 ||
    month > 12 ||
    !Number.isInteger(year) ||
    !parsedDate ||
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new Error(`Fecha inválida en calendario: ${raw}`);
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

/** Extracts only the first main-term occurrence; the PDFs can append summer dates. */
export function extractAcademicTermDates(pdfText: string): AcademicTermDates {
  const text = pdfText.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n');
  const lastClassMatch = text.match(
    /(\d{1,2}\/\d{1,2}\/\d{4})[^\n]{0,100}ÚLTIMO\s+D[IÍ]A\s+DE\s+CLASES/i,
  );
  if (!lastClassMatch) {
    throw new Error('No se pudo extraer el último día de clases del PDF.');
  }

  const examMatch = text.match(
    /^[ \t]*(\d{1,2}\/\d{1,2}(?:\/\d{4})?)\s*(?:-|–|al)\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+EX[ÁA]MENES[ \t]*$/im,
  );
  if (!examMatch) {
    throw new Error('No se pudo extraer el período de exámenes del PDF.');
  }

  const examEndDay = calendarDay(examMatch[2]);
  const examEndYear = Number(examEndDay.slice(0, 4));
  const lastClassDay = calendarDay(lastClassMatch[1]);
  const examStartDay = calendarDay(examMatch[1], examEndYear);
  if (examStartDay > examEndDay || lastClassDay > examEndDay) {
    throw new Error('Las fechas extraídas del calendario no tienen un orden válido.');
  }

  return {
    lastClassDay,
    examStartDay,
    examEndDay,
    roadmapFreezeDate: examEndDay,
  };
}

export async function extractPdfText(pdf: Uint8Array) {
  const parser = new PDFParse({ data: pdf });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

export async function fetchPublishedAcademicTerm(
  term: AcademicTermIdentifier,
  dependencies: {
    fetcher?: Fetcher;
    extractText?: (pdf: Uint8Array) => Promise<string>;
  } = {},
): Promise<PublishedAcademicTerm> {
  const fetcher = dependencies.fetcher ?? fetch;
  const pageResponse = await fetcher(ACADEMIC_CALENDAR_PAGE_URL, {
    headers: { Accept: 'text/html' },
  });
  if (!pageResponse.ok) {
    throw new Error(`No se pudo descargar la página de calendarios (HTTP ${pageResponse.status}).`);
  }

  const sourcePdfUrl = selectTermCalendarPdf(await pageResponse.text(), term);
  const pdfResponse = await fetcher(sourcePdfUrl, { headers: { Accept: 'application/pdf' } });
  if (!pdfResponse.ok) {
    throw new Error(`No se pudo descargar el PDF del calendario (HTTP ${pdfResponse.status}).`);
  }

  const pdf = new Uint8Array(await pdfResponse.arrayBuffer());
  if (pdf.byteLength === 0 || pdf.byteLength > 15 * 1024 * 1024) {
    throw new Error('El PDF del calendario está vacío o supera el límite de 15 MB.');
  }

  return {
    ...term,
    ...extractAcademicTermDates(await (dependencies.extractText ?? extractPdfText)(pdf)),
    sourcePageUrl: ACADEMIC_CALENDAR_PAGE_URL,
    sourcePdfUrl,
  };
}
