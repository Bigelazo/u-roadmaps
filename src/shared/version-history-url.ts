export function versionHistoryUrl(courseCode: string): string {
  return `/courses/${encodeURIComponent(courseCode)}/versions`;
}

export type VersionIdentifier = Readonly<{ courseCode: string; year: number; semester: number }>;

export function versionUrl({ courseCode, year, semester }: VersionIdentifier): string {
  return `${versionHistoryUrl(courseCode)}/${year}/${semester}`;
}

export function versionHistoryApiUrl(courseCode: string): string {
  return `/api/${encodeURIComponent(courseCode)}/versions`;
}

export function versionApiUrl(
  { courseCode, year, semester }: VersionIdentifier,
  suffix = '',
): string {
  return `${versionHistoryApiUrl(courseCode)}/${year}/${semester}${suffix}`;
}
