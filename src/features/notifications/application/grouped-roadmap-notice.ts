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

export function groupedRoadmapNotice(notice: PendingNotice, count: number): PendingNotice {
  const data = notice.data as Record<string, NoticeData>;
  return {
    ...notice,
    subject: `El Roadmap de ${data.courseCode} ha recibido cambios`,
    body: `El Roadmap ha recibido ${count} cambios.`,
    data: {
      roadmapId: notice.roadmapId,
      courseCode: data.courseCode,
      year: data.year,
      semester: data.semester,
      occurredAt: notice.availableAt.toISOString(),
      targetCount: count,
    },
  };
}
