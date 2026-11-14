import type {
  OwnInboxNotice,
  OwnInboxOffering,
  OwnInboxSnapshot,
} from '../contracts/own-inbox-snapshot';

export type OfferingFilter = Readonly<{ courseCode: string; year: number; semester: number }>;

export type OwnInboxView = Readonly<{
  available: boolean;
  total: number;
  unreadFor: (offering: OfferingFilter) => number;
  noticesFor: (offering?: OfferingFilter) => readonly OwnInboxNotice[];
}>;

export const emptySnapshot: OwnInboxSnapshot = { total: 0, offerings: [], notices: [] };

function matches(offering: OwnInboxOffering, filter: OfferingFilter) {
  return (
    offering.courseCode === filter.courseCode &&
    offering.year === filter.year &&
    offering.semester === filter.semester
  );
}

function unreadIn(offerings: readonly OwnInboxOffering[]) {
  return offerings.reduce((sum, offering) => sum + offering.unread, 0);
}

export function viewOwnInbox(
  snapshot: OwnInboxSnapshot | null,
  acknowledged: ReadonlySet<string>,
): OwnInboxView {
  const source = snapshot ?? emptySnapshot;
  const offerings = source.offerings.filter((offering) => !acknowledged.has(offering.roadmapId));
  const notices = source.notices.filter((notice) => !acknowledged.has(notice.roadmapId));
  const offeringsOf = (filter: OfferingFilter) =>
    offerings.filter((offering) => matches(offering, filter));
  return {
    available: snapshot !== null,
    total: unreadIn(offerings),
    unreadFor: (filter) => unreadIn(offeringsOf(filter)),
    noticesFor: (filter) => {
      if (!filter) return notices;
      const roadmaps = new Set(offeringsOf(filter).map(({ roadmapId }) => roadmapId));
      return notices.filter((notice) => roadmaps.has(notice.roadmapId));
    },
  };
}
