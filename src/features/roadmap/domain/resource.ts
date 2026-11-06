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
    return 'Un Archivo solo permite cambiar su título.';
  if (changes.type !== undefined && changes.type !== type)
    return 'Para cambiar el tipo de recurso, elimínalo y crea uno nuevo.';
  return null;
}
