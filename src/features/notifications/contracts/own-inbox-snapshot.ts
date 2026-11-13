export type OwnInboxNotice = Readonly<{
  id: string;
  roadmapId: string;
  courseName?: string;
  subject?: string | null;
  body?: string | null;
  data?: Record<string, unknown>;
  createdAt: string;
}>;

export type OwnInboxOffering = Readonly<{
  roadmapId: string;
  courseCode: string;
  year: number;
  semester: number;
  unread: number;
}>;

export type OwnInboxSnapshot = Readonly<{
  total: number;
  offerings: readonly OwnInboxOffering[];
  notices: readonly OwnInboxNotice[];
}>;
