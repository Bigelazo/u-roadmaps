/** The Roadmap version history page of a Course (Ramo). */
export function versionHistoryUrl(courseCode: string): string {
  return `/courses/${encodeURIComponent(courseCode)}/versions`;
}

export type VersionIdentifier = Readonly<{ courseCode: string; year: number; semester: number }>;

/** The read-only viewer page of one Roadmap version. */
export function versionUrl({ courseCode, year, semester }: VersionIdentifier): string {
  return `${versionHistoryUrl(courseCode)}/${year}/${semester}`;
}

/** The API resource listing the Roadmap versions of a Course (Ramo). */
export function versionHistoryApiUrl(courseCode: string): string {
  return `/api/${encodeURIComponent(courseCode)}/versions`;
}

/** The API resource of one Roadmap version. */
export function versionApiUrl(
  { courseCode, year, semester }: VersionIdentifier,
  suffix = '',
): string {
  return `${versionHistoryApiUrl(courseCode)}/${year}/${semester}${suffix}`;
}
