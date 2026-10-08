import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { literal, literalList, queryJson, sql } from './database';

// Test-owned rows are recognizable without IDs, so orphans can be removed safely.
export const syntheticTermYearStart = 1000;
export const syntheticTermYearEnd = 1999;
export const courseCodePrefix = 'E2E-';
export const userEmailDomain = 'e2e.u-roadmaps.test';
/** Tables a test can make PostgreSQL reject writes to, with their trigger name prefix. */
export const rejectionPrefixes = {
  Roadmap: 'e2e_reject_closure_',
  RoadmapNotice: 'e2e_reject_notices_',
  Resource: 'e2e_reject_resources_',
} as const;
export type RejectedTable = keyof typeof rejectionPrefixes;

/** What one test created, or every test-owned leftover of an interrupted run. */
export type TestDataScope =
  | {
      courseCodes: readonly string[];
      userIds: readonly string[];
      termYears: readonly number[];
      rejections: Readonly<Record<RejectedTable, readonly string[]>>;
    }
  | 'orphans';

export const uploadsDirectory = () =>
  join(process.cwd(), process.env.UPLOADS_DIRECTORY || 'uploads-e2e');

/**
 * Drops notice rejection triggers, then deletes Courses (Ramos) and Users with
 * everything that cascades from them and the uploaded files of their Resources.
 */
export async function removeTestData(scope: TestDataScope) {
  try {
    for (const table of Object.keys(rejectionPrefixes) as RejectedTable[])
      await dropRejections(scope, table, scope === 'orphans' ? [] : scope.rejections[table]);
  } finally {
    await deleteCoursesAndUsers(scope);
    const condition =
      scope === 'orphans'
        ? `year BETWEEN ${syntheticTermYearStart} AND ${syntheticTermYearEnd}`
        : `year IN (${scope.termYears.map(literal).join(', ') || 'NULL'})`;
    await sql(`DELETE FROM "AcademicTerm" WHERE ${condition};`);
  }
}

function dropRejections(scope: TestDataScope, table: RejectedTable, names: readonly string[]) {
  const prefix = rejectionPrefixes[table];
  const condition =
    scope === 'orphans'
      ? `starts_with(tgname, ${literal(prefix)})`
      : `tgname IN (${literalList(names)})`;
  return sql(`
    DO $$ DECLARE name text; BEGIN
      FOR name IN SELECT tgname FROM pg_trigger
        WHERE tgrelid = '"${table}"'::regclass AND NOT tgisinternal AND ${condition}
      LOOP
        EXECUTE format('DROP TRIGGER %I ON "${table}"', name);
        EXECUTE format('DROP FUNCTION IF EXISTS %I()', name);
        EXECUTE format('DROP SEQUENCE IF EXISTS %I', name || '_attempts');
      END LOOP;
    END $$;
  `);
}

async function deleteCoursesAndUsers(scope: TestDataScope) {
  const [courseCondition, userCondition] =
    scope === 'orphans'
      ? [
          `starts_with("code", ${literal(courseCodePrefix)})`,
          `"institutionalEmail" LIKE ${literal(`%@${userEmailDomain}`)}`,
        ]
      : [
          `"code" IN (${literalList(scope.courseCodes)})`,
          `"id" IN (${literalList(scope.userIds)})`,
        ];
  const courses = `SELECT "code" FROM "Course" WHERE ${courseCondition}`;
  const users = `SELECT "id" FROM "User" WHERE ${userCondition}`;
  const roadmaps = `SELECT r."id" FROM "Roadmap" r JOIN "CourseOffering" o ON o."id" = r."courseOfferingId" WHERE o."courseCode" IN (${courses})`;
  const fileKeys = await queryJson<string[] | null>(`
    -- Match entry's parent-before-receipt lock order while requests finish.
    DO $$ BEGIN
      PERFORM r."id" FROM "Roadmap" r WHERE r."id" IN (${roadmaps})
        ORDER BY r."id" FOR UPDATE;
    END $$;
    SELECT json_agg(resource."fileKey") FROM "Resource" resource
    JOIN "RoadmapNode" node ON node."id" = resource."roadmapNodeId"
    WHERE resource."fileKey" IS NOT NULL AND node."roadmapId" IN (${roadmaps});
    DELETE FROM "NoticeAcknowledgement" WHERE "recipientId" IN (${users}) OR "roadmapId" IN (${roadmaps});
    DELETE FROM "RoadmapNotice" WHERE "courseOfferingId" IN (SELECT "id" FROM "CourseOffering" WHERE "courseCode" IN (${courses}));
    DELETE FROM "Course" WHERE "code" IN (${courses});
    DELETE FROM "User" WHERE "id" IN (${users});
  `);
  const directory = uploadsDirectory();
  await Promise.all(
    (fileKeys ?? []).map((fileKey) => rm(join(directory, fileKey), { force: true })),
  );
}
