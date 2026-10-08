import { reportUcampusPosition, forgetUcampusUser } from './ucampus';
import type { MufasaInstitutionalCoursePosition } from '@/integrations/ucampus/server';
import { randomUUID } from 'node:crypto';
import { test as base, type APIRequestContext } from '@playwright/test';
import {
  copyFixtureRoadmap,
  developmentFixtureIds,
  fixtureCompletions,
  fixtureParticipations,
  fixtureRoadmaps,
  fixtureUsers,
} from '@/development/fixtures/catalog';
import { insert, literal, queryJson, sql } from './database';
import type { NoticeClass } from '@/features/notifications/application/notice-effect';
import { fixtureRoadmapPath, sessionCookie } from './helpers';
import {
  courseCodePrefix,
  noticeRejectionPrefix,
  removeTestData,
  userEmailDomain,
} from './test-data';

export { expect } from '@playwright/test';

type InstitutionalCoursePosition =
  import('@/shared/institutional-position').InstitutionalCoursePosition;
type ParticipationRole = 'TEACHER' | 'STUDENT';

export type E2EUser = {
  id: string;
  name: string;
  institutionalEmail: string;
  /** RUT body without verifier, as stored on the User. */
  rut: string;
};

// The `course` and `createCourse` fixture names follow the spec's "Curso": they
// create Course offerings, each under its own Course (Ramo).
export type E2ECourseOffering = {
  id: string;
  courseCode: string;
  courseName: string;
  year: number;
  semester: number;
  roadmapId: string | null;
  apiPath(suffix?: string): string;
  pagePath(): string;
};

/** The test's own copy of the CC1002 Course offering, its Roadmap and Users. */
export type E2EPrimaryCourseOffering = E2ECourseOffering & {
  roadmapId: string;
  nodes: { first: string; second: string; hidden: string };
  users: Record<CourseUserKey, E2EUser>;
};

export type CourseOfferingOptions = {
  /** Copy the CC1002 Roadmap template. Defaults to true. */
  roadmap?: boolean;
  year?: number;
  semester?: number;
  /** Another offering of the test's Course (Ramo), instead of a new Course. */
  sameCourseAs?: E2ECourseOffering;
  participants?: readonly {
    user: E2EUser;
    role: ParticipationRole;
    institutionalPosition?: InstitutionalCoursePosition | null;
    isActive?: boolean;
  }[];
};

function catalogUserIdByRut(rut: string) {
  const user = fixtureUsers.find((user) => user.rut === rut);
  if (!user) throw new Error(`Catalog User with RUT ${rut} is missing.`);
  return user.id;
}

// Each User takes its Participation and progress from a CC1002 catalog User.
const templateUsers = {
  teacher: { catalogId: developmentFixtureIds.daniela, label: 'Docente' },
  teachingAssistant: { catalogId: developmentFixtureIds.nicolas, label: 'Ayudante' },
  studentWithoutProgress: {
    catalogId: catalogUserIdByRut('20000001'),
    label: 'Estudiante sin progreso',
  },
  studentWithProgress: {
    catalogId: catalogUserIdByRut('20000009'),
    label: 'Estudiante con progreso',
  },
  studentComplete: {
    catalogId: catalogUserIdByRut('20000048'),
    label: 'Estudiante completo',
  },
  withdrawnStudent: {
    catalogId: catalogUserIdByRut('20000050'),
    label: 'Estudiante retirado',
  },
  // Also enrolled in MA1001 and FI1001 in the catalog; tests add other Courses explicitly.
  multiCourseStudent: {
    catalogId: catalogUserIdByRut('20000002'),
    label: 'Estudiante multicurso',
  },
} as const;
type CourseUserKey = keyof typeof templateUsers;

const template = fixtureRoadmaps.find(({ id }) => id === developmentFixtureIds.roadmaps.cc1002)!;
const templateNodeIds = new Set(template.nodes.map(({ id }) => id));
const academicTerm = { year: 2026, semester: 2 };

function templateParticipation(catalogUserId: string) {
  const participation = fixtureParticipations.find(
    ({ userId, courseOfferingId }) =>
      userId === catalogUserId && courseOfferingId === developmentFixtureIds.offerings.cc1002,
  );
  if (!participation) throw new Error(`Catalog User ${catalogUserId} is not in CC1002.`);
  return participation;
}

// Unique within an invocation (worker indexes are never reused); globalSetup
// removes earlier invocations' data, so codes and RUTs cannot collide.
let serial = 0;
function nextSerial(workerIndex: number) {
  serial += 1;
  if (workerIndex > 999 || serial > 9999) throw new Error('E2E serial space exhausted.');
  const worker = String(workerIndex).padStart(3, '0');
  const number = String(serial).padStart(4, '0');
  // RUT bodies 3xxxxxxx stay outside the catalog's 1000000x and 20000xxx ranges.
  return { token: `w${worker}n${number}`, rut: `3${worker}${number}` };
}

function newUser(key: CourseUserKey, workerIndex: number): E2EUser {
  const { token, rut } = nextSerial(workerIndex);
  return {
    id: randomUUID(),
    name: `${templateUsers[key].label} ${token}`,
    institutionalEmail: `${key.toLowerCase()}.${token}@${userEmailDomain}`,
    rut,
  };
}

/** SQL for a Course (Ramo), its Course offering and optionally a copy of the CC1002 Roadmap. */
function courseOfferingScript(options: CourseOfferingOptions, workerIndex: number) {
  const { token } = nextSerial(workerIndex);
  const courseCode =
    options.sameCourseAs?.courseCode ?? `${courseCodePrefix}${token.toUpperCase()}`;
  const courseName = options.sameCourseAs?.courseName ?? `Ramo E2E ${token}`;
  const { year = academicTerm.year, semester = academicTerm.semester } = options;
  const offeringId = randomUUID();
  const roadmap = options.roadmap === false ? null : copyFixtureRoadmap(template, randomUUID);
  let script =
    (options.sameCourseAs
      ? ''
      : insert('Course', [
          { code: courseCode, name: courseName, department: 'Departamento E2E' },
        ])) +
    insert('CourseOffering', [{ id: offeringId, courseCode, year, semester }]) +
    insert(
      'Participation',
      (options.participants ?? []).map(
        ({ user, role, institutionalPosition = null, isActive = true }) => ({
          id: randomUUID(),
          userId: user.id,
          courseOfferingId: offeringId,
          role,
          institutionalPosition,
          isActive,
        }),
      ),
    );
  if (roadmap) {
    const updatedAt = new Date();
    script +=
      insert('Roadmap', [{ id: roadmap.roadmapId, courseOfferingId: offeringId }]) +
      insert('NodeType', [roadmap.customNodeType]) +
      insert('RoadmapNode', roadmap.nodes) +
      insert('Dependency', roadmap.dependencies) +
      insert(
        'Resource',
        roadmap.resources.map((resource) => ({ ...resource, updatedAt })),
      );
  }
  const offering: E2ECourseOffering = {
    id: offeringId,
    courseCode,
    courseName,
    year,
    semester,
    roadmapId: roadmap?.roadmapId ?? null,
    apiPath: (suffix) => fixtureRoadmapPath({ courseCode, year, semester }, suffix),
    pagePath: () => `/courses/${courseCode}/${year}/${semester}`,
  };
  return { offering, script, roadmap };
}

type OwnedTestData = { courseCodes: string[]; userIds: string[]; noticeRejections: string[] };

export const test = base.extend<{
  ownedTestData: OwnedTestData;
  course: E2EPrimaryCourseOffering;
  createCourse: (options?: CourseOfferingOptions) => Promise<E2ECourseOffering>;
  createUser: () => Promise<E2EUser>;
  /**
   * Makes PostgreSQL reject inserts of notices for one Roadmap, or for the
   * Roadmap of a Course offering when the test has yet to create it.
   */
  rejectNoticeInserts: (
    target: ({ roadmapId: string } | { courseOfferingId: string }) & { noticeClass?: NoticeClass },
  ) => Promise<{ wasAttempted: () => Promise<boolean> }>;
  reportPosition: (
    user: E2EUser,
    offering: E2ECourseOffering,
    position: MufasaInstitutionalCoursePosition | null,
  ) => Promise<void>;
  /** An API client authenticated as a User; disposed when the test ends. */
  apiAs: (user: E2EUser) => Promise<APIRequestContext>;
}>({
  // Everything a test creates; removed even when the test fails.
  ownedTestData: async ({}, provide) => {
    const owned: OwnedTestData = { courseCodes: [], userIds: [], noticeRejections: [] };
    await provide(owned);
    await removeTestData(owned);
  },

  course: async ({ ownedTestData }, provide, testInfo) => {
    const keys = Object.keys(templateUsers) as CourseUserKey[];
    const users = Object.fromEntries(
      keys.map((key) => [key, newUser(key, testInfo.workerIndex)]),
    ) as Record<CourseUserKey, E2EUser>;
    const participants = keys.map((key) => {
      const { role, institutionalPosition, isActive } = templateParticipation(
        templateUsers[key].catalogId,
      );
      return { user: users[key], role, institutionalPosition, isActive };
    });
    const { offering, script, roadmap } = courseOfferingScript(
      { participants },
      testInfo.workerIndex,
    );
    const completions = keys.flatMap((key) =>
      fixtureCompletions
        .filter(
          ({ userId, roadmapNodeId }) =>
            userId === templateUsers[key].catalogId && templateNodeIds.has(roadmapNodeId),
        )
        .map(({ roadmapNodeId, completedAt }) => ({
          id: randomUUID(),
          userId: users[key].id,
          roadmapNodeId: roadmap!.nodeIdFor(roadmapNodeId),
          completedAt,
        })),
    );
    ownedTestData.userIds.push(...Object.values(users).map(({ id }) => id));
    ownedTestData.courseCodes.push(offering.courseCode);
    await sql(insert('User', Object.values(users)) + script + insert('Completion', completions));
    const hidden = template.nodes.find(({ isVisible }) => !isVisible)!;
    await provide({
      ...offering,
      roadmapId: roadmap!.roadmapId,
      nodes: {
        first: roadmap!.nodeIdFor(template.nodes[0].id),
        second: roadmap!.nodeIdFor(template.nodes[1].id),
        hidden: roadmap!.nodeIdFor(hidden.id),
      },
      users,
    });
  },

  createCourse: async ({ ownedTestData, reportPosition }, provide, testInfo) => {
    await provide(async (options = {}) => {
      const { offering, script } = courseOfferingScript(options, testInfo.workerIndex);
      ownedTestData.courseCodes.push(offering.courseCode);
      await sql(script);
      if (options.roadmap === false) {
        for (const { user, role, isActive = true } of options.participants ?? []) {
          if (role === 'TEACHER' && isActive)
            await reportPosition(user, offering, 'COURSE_PROFESSOR');
        }
      }
      return offering;
    });
  },

  rejectNoticeInserts: async ({ ownedTestData }, provide, testInfo) => {
    await provide(async (target) => {
      const name = `${noticeRejectionPrefix}${nextSerial(testInfo.workerIndex).token}`;
      const scope =
        'roadmapId' in target
          ? `NEW."roadmapId" = ${literal(target.roadmapId)}`
          : `NEW."courseOfferingId" = ${literal(target.courseOfferingId)}`;
      const condition = `${scope}${target.noticeClass ? ` AND NEW."data"->>'noticeClass' = ${literal(target.noticeClass)}` : ''}`;
      const sequence = `${name}_attempts`;
      ownedTestData.noticeRejections.push(name);
      await sql(`
        CREATE SEQUENCE ${sequence};
        CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF ${condition} THEN
            PERFORM nextval('${sequence}');
            RAISE EXCEPTION 'E2E notification failure';
          END IF;
          RETURN NEW;
        END; $$;
        CREATE TRIGGER ${name} BEFORE INSERT ON "RoadmapNotice"
          FOR EACH ROW EXECUTE FUNCTION ${name}();
      `);
      return {
        wasAttempted: () => queryJson<boolean>(`SELECT to_json(is_called) FROM ${sequence};`),
      };
    });
  },

  createUser: async ({ ownedTestData }, provide, testInfo) => {
    await provide(async () => {
      const user = newUser('studentWithoutProgress', testInfo.workerIndex);
      ownedTestData.userIds.push(user.id);
      await sql(insert('User', [user]));
      return user;
    });
  },

  reportPosition: async ({}, provide) => {
    const users = new Map<string, E2EUser>();
    await provide(async (user, offering, position) => {
      users.set(user.id, user);
      await reportUcampusPosition(user, offering, position);
    });
    await Promise.all([...users.values()].map(forgetUcampusUser));
  },

  apiAs: async ({ playwright, baseURL }, provide) => {
    const clients: APIRequestContext[] = [];
    await provide(async (user) => {
      const client = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { cookie: await sessionCookie(user.id) },
      });
      clients.push(client);
      return client;
    });
    await Promise.all(clients.map((client) => client.dispose()));
  },
});
