import 'server-only';
import { prisma, Prisma } from '@/shared/server/db';
import { groupedRoadmapNotice } from '../application/group-roadmap-notices';
import { noticeTargetDescriptors, type ShownTo } from '../application/notice-targets';

export type InboxFilter = {
  roadmapId?: string;
  nodeId?: string;
  courseCode?: string;
  year?: number;
  semester?: number;
};

type InboxNotice = {
  id: string;
  roadmapId: string;
  courseName: string;
  subject: string;
  body: string;
  data: Prisma.JsonValue;
  availableAt: Date;
  acknowledgedAt: Date | null;
  targetCount: bigint;
};

/**
 * Pending notices fill the Inbox. Unreviewed notices mark a Node on the canvas:
 * recognized or not, they changed after the recipient last opened that Node.
 */
type NoticeScope = 'pending' | 'unreviewed';

/** The recipient, with the Nodes they can open in the Roadmaps the request reads. */
export type InboxRecipient = Readonly<{ userId: string; accessibleNodeIds: readonly string[] }>;

/**
 * Keep the backlog in PostgreSQL; only the requested page leaves it. Node access is decided
 * by the participant view and arrives as data.
 */
function visibleNotices(
  { userId, accessibleNodeIds }: InboxRecipient,
  filter: InboxFilter,
  scope: NoticeScope = 'pending',
) {
  const conditions = [
    Prisma.sql`notice."recipientId" = ${userId}::uuid`,
    scope === 'pending'
      ? Prisma.sql`notice."acknowledgedAt" IS NULL`
      : Prisma.sql`jsonb_typeof(notice.data->'nodeId') = 'string'
        AND (participation."noticeResetAt" IS NULL OR notice."availableAt" > participation."noticeResetAt")
        AND NOT EXISTS (SELECT 1 FROM "NodeChangeReview" review
          WHERE review."recipientId" = notice."recipientId"
            AND review."nodeId"::text = notice.data->>'nodeId'
            AND review."reviewedAt" >= notice."availableAt")`,
  ];
  if (filter.roadmapId) conditions.push(Prisma.sql`notice."roadmapId" = ${filter.roadmapId}::uuid`);
  if (filter.nodeId) conditions.push(Prisma.sql`notice.data->>'nodeId' = ${filter.nodeId}`);
  if (filter.courseCode)
    conditions.push(Prisma.sql`notice.data->>'courseCode' = ${filter.courseCode}`);
  if (filter.year !== undefined)
    conditions.push(Prisma.sql`notice.data->'year' = ${JSON.stringify(filter.year)}::jsonb`);
  if (filter.semester !== undefined)
    conditions.push(
      Prisma.sql`notice.data->'semester' = ${JSON.stringify(filter.semester)}::jsonb`,
    );
  return Prisma.sql`
    WITH pending AS MATERIALIZED (
      SELECT notice.*, course.name AS "courseName"
      FROM "RoadmapNotice" notice
      JOIN "Roadmap" roadmap ON roadmap.id = notice."roadmapId"
      JOIN "Participation" participation ON participation."courseOfferingId" = roadmap."courseOfferingId"
        AND participation."userId" = notice."recipientId" AND participation."isActive"
      JOIN "CourseOffering" offering ON offering.id = roadmap."courseOfferingId"
      JOIN "Course" course ON course.code = offering."courseCode"
      WHERE ${Prisma.join(conditions, ' AND ')}
    ), nodes AS MATERIALIZED (
      SELECT node.id, node."roadmapId", node."isVisible", node."nodeTypeId"
      FROM "RoadmapNode" node
      WHERE node."roadmapId" IN (SELECT "roadmapId" FROM pending)
    ), visible AS (
      SELECT pending.* FROM pending LEFT JOIN nodes node ON node.id::text = pending.data->>'nodeId'
        AND node."roadmapId" = pending."roadmapId"
      WHERE jsonb_typeof(pending.data) = 'object' AND ${shownToCase(accessibleNodeIds)}
    )`;
}

/** One `WHEN` per `shownTo` class over its Notice targets, as `isNoticeVisible` decides it. */
function shownToCase(accessibleNodeIds: readonly string[]) {
  const visibleNode = (column: string) => Prisma.sql`EXISTS (SELECT 1 FROM nodes other
    WHERE other.id::text = pending.data->>${column}::text AND other."roadmapId" = pending."roadmapId"
      AND other."isVisible")`;
  const opensNode = Prisma.sql`COALESCE(node."isVisible" AND node.id = ANY(${accessibleNodeIds}::uuid[]), FALSE)`;
  const conditions: Record<ShownTo, Prisma.Sql> = {
    everyone: Prisma.sql`TRUE`,
    'node-viewers': Prisma.sql`COALESCE(node."isVisible", FALSE)`,
    'node-openers': opensNode,
    'dependency-viewers': Prisma.sql`${visibleNode('sourceNodeId')} AND ${visibleNode('targetNodeId')}`,
    'node-type-viewers': Prisma.sql`EXISTS (SELECT 1 FROM nodes typed
      WHERE typed."nodeTypeId"::text = pending.data->>'nodeTypeId'
        AND typed."roadmapId" = pending."roadmapId" AND typed."isVisible")`,
  };
  const whens = Object.entries(conditions).map(([shownTo, condition]) => {
    const targets = noticeTargetDescriptors
      .filter((descriptor) => descriptor.shownTo === shownTo)
      .map(({ noticeTarget }) => noticeTarget);
    return Prisma.sql`WHEN pending.data->>'noticeTarget' = ANY(${targets}::text[]) THEN ${condition}`;
  });
  // A row no descriptor owns follows `node-openers` on its Node; without one it is shown as stored.
  return Prisma.sql`CASE ${Prisma.join(whens, ' ')}
    ELSE jsonb_typeof(pending.data->'nodeId') IS DISTINCT FROM 'string' OR ${opensNode} END`;
}

export async function queryInboxPage(
  recipient: InboxRecipient,
  filter: InboxFilter,
  {
    limit,
    grouped,
    cursor,
  }: { limit: number; grouped: boolean; cursor: { id: string; availableAt: Date } | null },
) {
  const rows = await prisma.$queryRaw<InboxNotice[]>(Prisma.sql`
    ${visibleNotices(recipient, filter)}, ranked AS (
      SELECT visible.*,
        count(*) OVER (PARTITION BY "roadmapId", COALESCE(data->>'changeKind' = 'roadmap-available', FALSE)) AS "targetCount",
        row_number() OVER (PARTITION BY "roadmapId", COALESCE(data->>'changeKind' = 'roadmap-available', FALSE)
          ORDER BY "availableAt" DESC, id DESC) AS position
      FROM visible
    )
    SELECT id, "roadmapId", "courseName", subject, body, data, "availableAt", "acknowledgedAt", "targetCount"
    FROM ranked WHERE (
      NOT ${grouped} OR data->>'changeKind' = 'roadmap-available' OR "targetCount" < 3 OR position = 1
    ) ${cursor ? Prisma.sql`AND ("availableAt", id) < (${cursor.availableAt}, ${cursor.id}::uuid)` : Prisma.empty}
    ORDER BY "availableAt" DESC, id DESC LIMIT ${limit + 1}
  `);
  return {
    notices: rows
      .slice(0, limit)
      .map((row) =>
        grouped &&
        Number(row.targetCount) >= 3 &&
        (row.data as Record<string, unknown>)?.changeKind !== 'roadmap-available'
          ? groupedRoadmapNotice(row, Number(row.targetCount))
          : row,
      ),
    hasMore: rows.length > limit,
  };
}

export async function queryInboxCounts(recipient: InboxRecipient, filter: InboxFilter) {
  const [row] = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    ${visibleNotices(recipient, filter)}
    SELECT count(*) AS count FROM visible
  `);
  return { count: Number(row?.count ?? 0) };
}

/** Count changed objects, not notices: a target recognized and changed again counts once. */
export async function queryNodeChangeCounts(recipient: InboxRecipient, roadmapId: string) {
  const rows = await prisma.$queryRaw<{ nodeId: string; count: bigint }[]>(Prisma.sql`
    ${visibleNotices(recipient, { roadmapId }, 'unreviewed')}
    SELECT data->>'nodeId' AS "nodeId", count(DISTINCT COALESCE("targetKey", id::text)) AS count
    FROM visible GROUP BY 1
  `);
  return { byNode: Object.fromEntries(rows.map((row) => [row.nodeId, Number(row.count)])) };
}
