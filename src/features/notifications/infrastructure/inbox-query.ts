import 'server-only';
import { prisma, Prisma } from '@/shared/server/db';
import { groupedRoadmapNotice } from '../application/group-roadmap-notices';

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

/** Keep backlog data and access evaluation in PostgreSQL; only the requested page leaves it. */
function visibleNotices(userId: string, filter: InboxFilter, scope: NoticeScope = 'pending') {
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
    WITH RECURSIVE pending AS MATERIALIZED (
      SELECT notice.*, participation.role, course.name AS "courseName"
      FROM "RoadmapNotice" notice
      JOIN "Roadmap" roadmap ON roadmap.id = notice."roadmapId"
      JOIN "Participation" participation ON participation."courseOfferingId" = roadmap."courseOfferingId"
        AND participation."userId" = notice."recipientId" AND participation."isActive"
      JOIN "CourseOffering" offering ON offering.id = roadmap."courseOfferingId"
      JOIN "Course" course ON course.code = offering."courseCode"
      WHERE ${Prisma.join(conditions, ' AND ')}
    ), nodes AS MATERIALIZED (
      SELECT node.*, participation.role,
        EXISTS (SELECT 1 FROM "Completion" completion
          WHERE completion."userId" = ${userId}::uuid AND completion."roadmapNodeId" = node.id) AS completed
      FROM "RoadmapNode" node
      JOIN "Roadmap" roadmap ON roadmap.id = node."roadmapId"
      JOIN "Participation" participation ON participation."courseOfferingId" = roadmap."courseOfferingId"
        AND participation."userId" = ${userId}::uuid AND participation."isActive"
      WHERE node."roadmapId" IN (SELECT "roadmapId" FROM pending)
    ), edges AS MATERIALIZED (
      SELECT dependency."sourceNodeId", dependency."targetNodeId"
      FROM "Dependency" dependency
      JOIN nodes source ON source.id = dependency."sourceNodeId" AND source."isVisible"
      JOIN nodes target ON target.id = dependency."targetNodeId" AND target."isVisible"
      WHERE target.role <> 'TEACHER'
    ), blocked(id) AS (
      SELECT node.id FROM nodes node WHERE node."isVisible" AND (
        node."isTeacherBlocked" OR EXISTS (
          SELECT 1 FROM edges edge JOIN nodes source ON source.id = edge."sourceNodeId"
          WHERE edge."targetNodeId" = node.id AND NOT source.completed
        )
      )
      UNION
      SELECT edge."targetNodeId" FROM blocked JOIN edges edge ON edge."sourceNodeId" = blocked.id
    ), visible AS (
      SELECT pending.* FROM pending LEFT JOIN nodes node ON node.id::text = pending.data->>'nodeId'
        AND node."roadmapId" = pending."roadmapId"
      WHERE jsonb_typeof(pending.data) = 'object' AND CASE
        WHEN pending.data->>'noticeTarget' = 'dependency' THEN
          EXISTS (SELECT 1 FROM nodes source WHERE source.id::text = pending.data->>'sourceNodeId'
            AND source."roadmapId" = pending."roadmapId" AND source."isVisible")
          AND EXISTS (SELECT 1 FROM nodes target WHERE target.id::text = pending.data->>'targetNodeId'
            AND target."roadmapId" = pending."roadmapId" AND target."isVisible")
        WHEN pending.data->>'noticeTarget' = 'node-type-name' THEN
          EXISTS (SELECT 1 FROM nodes typed WHERE typed."nodeTypeId"::text = pending.data->>'nodeTypeId'
            AND typed."roadmapId" = pending."roadmapId" AND typed."isVisible")
        WHEN pending.data->>'noticeTarget' = 'node-access' OR pending.data->>'changeKind' = 'node-deleted' THEN TRUE
        WHEN node.id IS NULL THEN pending.data->>'noticeTarget' IS DISTINCT FROM 'node-creation'
        WHEN NOT node."isVisible" THEN FALSE
        WHEN pending.data->>'noticeTarget' = 'node-description'
          OR pending.data->>'changeKind' IN ('resource-added', 'resource-updated', 'resource-removed')
          OR (pending.data->>'changeKind' = 'node-updated'
            AND NOT COALESCE(pending.data->'changedFields' @> '["title"]'::jsonb, FALSE)
            AND NOT COALESCE(pending.data->'changedFields' @> '["nodeType"]'::jsonb, FALSE)
            AND NOT COALESCE((pending.data->'noticeTarget') <> 'null'::jsonb, FALSE))
          THEN NOT EXISTS (SELECT 1 FROM blocked WHERE blocked.id = node.id)
        ELSE TRUE
      END
    )`;
}

export async function queryInboxPage(
  userId: string,
  filter: InboxFilter,
  {
    limit,
    grouped,
    cursor,
  }: { limit: number; grouped: boolean; cursor: { id: string; availableAt: Date } | null },
) {
  const rows = await prisma.$queryRaw<InboxNotice[]>(Prisma.sql`
    ${visibleNotices(userId, filter)}, ranked AS (
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

export async function queryInboxCounts(userId: string, filter: InboxFilter) {
  const [row] = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    ${visibleNotices(userId, filter)}
    SELECT count(*) AS count FROM visible
  `);
  return { count: Number(row?.count ?? 0) };
}

/** Count changed objects, not notices: a target recognized and changed again counts once. */
export async function queryNodeChangeCounts(userId: string, roadmapId: string) {
  const rows = await prisma.$queryRaw<{ nodeId: string; count: bigint }[]>(Prisma.sql`
    ${visibleNotices(userId, { roadmapId }, 'unreviewed')}
    SELECT data->>'nodeId' AS "nodeId", count(DISTINCT COALESCE("targetKey", id::text)) AS count
    FROM visible GROUP BY 1
  `);
  return { byNode: Object.fromEntries(rows.map((row) => [row.nodeId, Number(row.count)])) };
}
