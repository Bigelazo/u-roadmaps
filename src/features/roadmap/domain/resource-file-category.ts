import { fileTitleExtension } from './resource';

export type ResourceCategory =
  | 'link'
  | 'pdf'
  | 'presentation'
  | 'spreadsheet'
  | 'document'
  | 'archive'
  | 'image'
  | 'video'
  | 'audio'
  | 'code'
  | 'file';

type FileCategory = Exclude<ResourceCategory, 'link'>;

const extensionCategories: Record<string, FileCategory> = {
  pdf: 'pdf',
  ppt: 'presentation',
  pptx: 'presentation',
  odp: 'presentation',
  key: 'presentation',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  csv: 'spreadsheet',
  ods: 'spreadsheet',
  doc: 'document',
  docx: 'document',
  odt: 'document',
  rtf: 'document',
  txt: 'document',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  tgz: 'archive',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  bmp: 'image',
  heic: 'image',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  mkv: 'video',
  avi: 'video',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  m4a: 'audio',
  flac: 'audio',
  md: 'code',
  json: 'code',
  py: 'code',
  ipynb: 'code',
  js: 'code',
  ts: 'code',
  java: 'code',
  c: 'code',
  h: 'code',
  cpp: 'code',
  cs: 'code',
  go: 'code',
  rs: 'code',
  rb: 'code',
  php: 'code',
  sql: 'code',
  r: 'code',
  m: 'code',
  sh: 'code',
  html: 'code',
  css: 'code',
  xml: 'code',
  yaml: 'code',
  yml: 'code',
  tex: 'code',
};

const contentTypeCategories: Record<string, FileCategory> = {
  'application/pdf': 'pdf',
  'application/vnd.ms-powerpoint': 'presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
  'application/vnd.oasis.opendocument.presentation': 'presentation',
  'application/vnd.apple.keynote': 'presentation',
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'application/vnd.oasis.opendocument.spreadsheet': 'spreadsheet',
  'text/csv': 'spreadsheet',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.oasis.opendocument.text': 'document',
  'application/rtf': 'document',
  'text/rtf': 'document',
  'application/zip': 'archive',
  'application/x-zip-compressed': 'archive',
  'application/vnd.rar': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/x-tar': 'archive',
  'application/gzip': 'archive',
  'application/x-gzip': 'archive',
  'text/markdown': 'code',
  'application/json': 'code',
  'text/x-python': 'code',
  'application/x-ipynb+json': 'code',
  'text/javascript': 'code',
  'application/javascript': 'code',
  'text/html': 'code',
  'text/css': 'code',
  'application/xml': 'code',
  'text/xml': 'code',
};

const mediaPrefixes: readonly [string, FileCategory][] = [
  ['image/', 'image'],
  ['video/', 'video'],
  ['audio/', 'audio'],
];

function contentTypeEssence(contentType: string | null) {
  return contentType?.split(';')[0].trim().toLowerCase();
}

function contentTypeCategory(contentType: string | null): FileCategory | null {
  const essence = contentTypeEssence(contentType);
  if (!essence) return null;
  return (
    contentTypeCategories[essence] ??
    mediaPrefixes.find(([prefix]) => essence.startsWith(prefix))?.[1] ??
    null
  );
}

function extensionCategory(name: string): FileCategory | null {
  return extensionCategories[fileTitleExtension(name).slice(1).toLowerCase()] ?? null;
}

function isPlainText(contentType: string | null) {
  return contentTypeEssence(contentType) === 'text/plain';
}

export function resourceCategory(resource: {
  type: 'FILE' | 'LINK';
  title: string;
  fileContentType: string | null;
}): ResourceCategory {
  if (resource.type === 'LINK') return 'link';
  return (
    contentTypeCategory(resource.fileContentType) ??
    extensionCategory(resource.title) ??
    (isPlainText(resource.fileContentType) ? 'document' : 'file')
  );
}
