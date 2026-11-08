import { expect, test } from 'vitest';
import { resourceCategory } from '@/features/roadmap/domain/resource-file-category';
import { replaceFileTitleExtension } from '@/features/roadmap/domain/resource';

const file = (title: string, fileContentType: string | null = null) =>
  resourceCategory({ type: 'FILE', title, fileContentType });

test.each([
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'presentation'],
  ['application/vnd.ms-excel', 'spreadsheet'],
  ['text/csv; charset=utf-8', 'spreadsheet'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'document'],
  ['application/x-7z-compressed', 'archive'],
  ['image/png', 'image'],
  ['video/mp4', 'video'],
  ['audio/mpeg', 'audio'],
  ['text/markdown', 'code'],
  ['APPLICATION/JSON', 'code'],
])('the content type %s decides the %s category over the extension', (contentType, category) => {
  expect(file('descarga.zip', contentType)).toBe(category);
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

test('a replacement keeps the edited stem and adopts the new extension', () => {
  expect(replaceFileTitleExtension('Guía resuelta.docx', 'Guía.docx', 'solucion.pdf')).toBe(
    'Guía resuelta.pdf',
  );
  expect(replaceFileTitleExtension('README', 'README', 'notas.md')).toBe('README.md');
  expect(replaceFileTitleExtension('Guía.pdf', 'solucion.pdf', 'Guía.docx')).toBe('Guía.docx');
  expect(replaceFileTitleExtension('Datos.csv', 'Datos.csv', 'datos')).toBe('Datos');
});
