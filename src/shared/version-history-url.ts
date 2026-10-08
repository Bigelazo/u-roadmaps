/** The Roadmap version history page of a Course (Ramo). */
export function versionHistoryUrl(courseCode: string): string {
  return `/courses/${encodeURIComponent(courseCode)}/versions`;
}
