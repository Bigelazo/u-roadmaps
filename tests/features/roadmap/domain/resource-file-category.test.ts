import { expect, test } from 'vitest';
import { resourceCategory } from '@/features/roadmap/domain/resource-file-category';

const file = (title: string, fileContentType: string | null = null) =>
  resourceCategory({ type: 'FILE', title, fileContentType });

test.each([
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'presentation'],
  ['application/vnd.ms-excel', 'spreadsheet'],
  ['text/csv; charset=utf-8', 'spreadsheet'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'document'],
  ['application/zip', 'archive'],
  ['image/png', 'image'],
  ['video/mp4', 'video'],
  ['audio/mpeg', 'audio'],
  ['text/markdown', 'code'],
  ['APPLICATION/JSON', 'code'],
])('the content type %s decides the %s category over the title', (contentType, category) => {
  expect(file('sin-extension', contentType)).toBe(category);
});

test.each([
  ['Apunte.PDF', 'pdf'],
  ['Clase 3.key', 'presentation'],
  ['Notas.ods', 'spreadsheet'],
  ['Guía.rtf', 'document'],
  ['Código.tar.gz', 'archive'],
  ['Diagrama.webp', 'image'],
  ['Clase.mov', 'video'],
  ['Podcast.m4a', 'audio'],
  ['README.md', 'code'],
  ['tarea.py', 'code'],
  ['datos.json', 'code'],
])('without a known content type, the extension of %s decides %s', (title, category) => {
  expect(file(title, 'application/octet-stream')).toBe(category);
  expect(file(title)).toBe(category);
});

test('plain text defers to a known extension and otherwise is a document', () => {
  expect(file('tarea.py', 'text/plain')).toBe('code');
  expect(file('notas.txt', 'text/plain')).toBe('document');
  expect(file('notas', 'text/plain')).toBe('document');
});

test('unknown files are generic and Links are links whatever their address says', () => {
  expect(file('Guía')).toBe('file');
  expect(file('.env')).toBe('file');
  expect(file('modelo.stl', 'model/stl')).toBe('file');
  expect(
    resourceCategory({ type: 'LINK', title: 'Apunte.pdf', fileContentType: 'application/pdf' }),
  ).toBe('link');
});
