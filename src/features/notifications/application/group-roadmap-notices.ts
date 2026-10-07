type NoticeData =
  string | number | boolean | null | NoticeData[] | { [key: string]: NoticeData | undefined };

type PendingNotice = {
  id: string;
  roadmapId: string;
  subject: string;
  body: string;
  data: NoticeData;
  acknowledgedAt: Date | null;
  availableAt: Date;
};

// The newest target also supplies the row's cursor identity. Group before paging
// so a Roadmap cannot be split across pages or cross the threshold per page.
export function groupRoadmapNotices(notices: readonly PendingNotice[]): PendingNotice[] {
  const ordered = [...notices].sort(
    (a, b) => b.availableAt.getTime() - a.availableAt.getTime() || b.id.localeCompare(a.id),
  );
  const byRoadmap = new Map<string, PendingNotice[]>();
  for (const notice of ordered) {
    if ((notice.data as Record<string, NoticeData> | null)?.changeKind === 'roadmap-available')
      continue;
    const targets = byRoadmap.get(notice.roadmapId) ?? [];
    targets.push(notice);
    byRoadmap.set(notice.roadmapId, targets);
  }
  return ordered.flatMap((notice) => {
    const targets = byRoadmap.get(notice.roadmapId);
    if (
      (notice.data as Record<string, NoticeData> | null)?.changeKind === 'roadmap-available' ||
      !targets ||
      targets.length < 3
    )
      return [notice];
    if (targets[0].id !== notice.id) return [];
    const data = notice.data as Record<string, NoticeData>;
    return [
      {
        ...notice,
        subject: `El Roadmap de ${data.courseCode} ha recibido cambios`,
        body: `${targets.length} cambios`,
        data: {
          roadmapId: notice.roadmapId,
          courseCode: data.courseCode,
          year: data.year,
          semester: data.semester,
          occurredAt: notice.availableAt.toISOString(),
          changeKind: 'roadmap-grouped',
          targetKind: 'roadmap',
          targetCount: targets.length,
        },
      },
    ];
  });
}
