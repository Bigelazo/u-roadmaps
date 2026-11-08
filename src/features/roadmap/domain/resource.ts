export function fileResourceUrl(fileKey: string) {
  return `https://files.u-roadmaps.invalid/${fileKey}`;
}

export function linkResourceOnlyError(type: unknown): string | null {
  return type === 'LINK'
    ? null
    : 'Los recursos externos deben ser Enlaces. Para un Archivo, sube sus bytes.';
}

export function resourceEditError(
  type: 'FILE' | 'LINK',
  changes: { title?: string; type?: 'FILE' | 'LINK'; url?: string },
): string | null {
  if (type === 'FILE' && ('type' in changes || 'url' in changes))
    return 'Un Archivo solo permite cambiar su título o reemplazar su archivo.';
  if (changes.type !== undefined && changes.type !== type)
    return 'Para cambiar el tipo de recurso, elimínalo y crea uno nuevo.';
  return null;
}

export function fileTitleExtension(name: string) {
  const extensionIndex = name.lastIndexOf('.');
  return extensionIndex > 0 && extensionIndex < name.length - 1 ? name.slice(extensionIndex) : '';
}

export function replaceFileTitleExtension(title: string, previousName: string, nextName: string) {
  const previous = fileTitleExtension(previousName);
  const stem = previous && title.endsWith(previous) ? title.slice(0, -previous.length) : title;
  return stem + fileTitleExtension(nextName);
}
