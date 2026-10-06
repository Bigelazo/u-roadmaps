export type NoticeClass =
  | 'roadmap-available'
  | 'roadmap-node-changed'
  | 'roadmap-path-changed'
  | 'roadmap-resource-changed'
  | 'roadmap-classification-changed';

export type NoticeEffect = Readonly<{
  eventId: string;
  recipientId: string;
  roadmapId: string;
  courseOfferingId: string;
  noticeClass: NoticeClass;
  payload: Readonly<Record<string, unknown>>;
}>;
