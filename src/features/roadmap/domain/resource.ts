/** Where uploaded files are addressed; the bytes live in the protected upload volume. */
export function fileResourceUrl(fileKey: string) {
  return `https://files.u-roadmaps.invalid/${fileKey}`;
}
