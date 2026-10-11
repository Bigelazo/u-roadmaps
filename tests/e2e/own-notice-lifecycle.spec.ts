import type { APIRequestContext } from '@playwright/test';
import { expect, test, type E2EPrimaryCourseOffering } from './fixtures';
import { ok } from './helpers';
import { findNode, listNotices, pendingNotices, recognize, type StoredNotice } from './notices';

/** One kind's notice target, prepared on a fresh course for the shared lifecycle. */
type Subject = {
  /** The notices of this kind that `api`'s user has not recognized. */
  notices(api: APIRequestContext): Promise<StoredNotice[]>;
  /** Moves the target to a value; `known` is the value recipients already recognized. */
  change(value: string): Promise<unknown>;
  known: string;
  /** Preparing created a pending notice, recognized before the lifecycle starts. */
  createdPending?: boolean;
  /** Values for: first change, absorbed change, restart after the revert, change after recognition. */
  values: readonly [string, string, string, string];
  /** What the absorbed notice shows once the second change reaches it. */
  absorbed: (notice: StoredNotice) => unknown;
  absorbedValue: string;
  absorbedBody: string;
  restartedBody: string;
};

type Kind = {
  kind: string;
  prepare(author: APIRequestContext, course: E2EPrimaryCourseOffering): Promise<Subject>;
};

async function roadmapNode(author: APIRequestContext, course: E2EPrimaryCourseOffering) {
  const roadmap = await (await author.get(course.apiPath())).json();
  return { roadmap, node: findNode(roadmap, course.nodes.first) };
}

const byTarget = (target: string) => async (api: APIRequestContext, nodeId: string) =>
  (await pendingNotices(api, nodeId)).filter((notice) => notice.data.noticeTarget === target);

const kinds: Kind[] = [
  {
    kind: 'title',
    async prepare(author, course) {
      const { node } = await roadmapNode(author, course);
      const path = course.apiPath(`/nodes/${node.id}`);
      return {
        notices: (api) => pendingNotices(api, node.id),
        change: async (title) => ok(await author.patch(path, { data: { title } })),
        known: node.title,
        values: ['Recursividad', 'Recursividad avanzada', 'Pila', 'Pilas'],
        absorbed: (notice) => notice.body,
        absorbedValue: `«${node.title}» pasó a llamarse «Recursividad avanzada».`,
        absorbedBody: `«${node.title}» pasó a llamarse «Recursividad avanzada».`,
        restartedBody: '«Pila» pasó a llamarse «Pilas».',
      };
    },
  },
  {
    kind: 'Node description',
    async prepare(author, course) {
      const { node } = await roadmapNode(author, course);
      const path = course.apiPath(`/nodes/${node.id}`);
      const notices = byTarget('node-description');
      return {
        notices: (api) => notices(api, node.id),
        change: async (description) => ok(await author.patch(path, { data: { description } })),
        known: node.description,
        values: [
          'Primera descripción',
          'Segunda descripción',
          'Tercera descripción',
          'Cuarta descripción',
        ],
        absorbed: (notice) => notice.data.currentValue,
        absorbedValue: '"Segunda descripción"',
        absorbedBody: `Se actualizó la descripción de «${node.title}».`,
        restartedBody: `Se actualizó la descripción de «${node.title}».`,
      };
    },
  },
  {
    kind: 'Node type',
    async prepare(author, course) {
      const { roadmap, node } = await roadmapNode(author, course);
      const path = course.apiPath(`/nodes/${node.id}`);
      const known = roadmap.nodeTypes.find((type: { id: string }) => type.id === node.nodeTypeId);
      const typeIds: Record<string, string> = { [known.name]: known.id };
      for (const name of ['Lectura', 'Taller', 'Práctica', 'Seminario']) {
        const response = await ok(
          await author.post(course.apiPath('/node-types'), {
            data: { name, icon: 'BookOpen', color: '#024AD8' },
          }),
          201,
        );
        typeIds[name] = (await response.json()).nodeType.id;
      }
      const notices = byTarget('node-type');
      return {
        notices: (api) => notices(api, node.id),
        change: async (name) =>
          ok(await author.patch(path, { data: { nodeTypeId: typeIds[name] } })),
        known: known.name,
        values: ['Lectura', 'Taller', 'Práctica', 'Seminario'],
        absorbed: (notice) => notice.data.currentTypeName,
        absorbedValue: 'Taller',
        absorbedBody: `«${node.title}» pasó de tipo «${known.name}» a tipo «Taller».`,
        restartedBody: `«${node.title}» pasó de tipo «Práctica» a tipo «Seminario».`,
      };
    },
  },
  {
    kind: 'Resource',
    async prepare(author, course) {
      const { node } = await roadmapNode(author, course);
      const nodeId = node.id;
      const created = await author.post(course.apiPath(`/nodes/${nodeId}/resources`), {
        data: { title: 'Guía 3', url: 'https://example.test/guide', type: 'LINK' },
      });
      const resource = (await (await ok(created, 201)).json()).resource as { id: string };
      const path = course.apiPath(`/resources/${resource.id}`);
      return {
        notices: (api) => pendingNotices(api, nodeId),
        change: async (title) => ok(await author.patch(path, { data: { title } })),
        known: 'Guía 3',
        createdPending: true,
        values: ['Guía 3 resuelta', 'Guía 3 revisada', 'Guía 4', 'Guía 5'],
        absorbed: (notice) => notice.data.currentResource?.title,
        absorbedValue: 'Guía 3 revisada',
        absorbedBody: `Se actualizó el recurso «Guía 3» en «${node.title}». «Guía 3» ahora se llama «Guía 3 revisada».`,
        restartedBody: `Se actualizó el recurso «Guía 4» en «${node.title}». «Guía 4» ahora se llama «Guía 5».`,
      };
    },
  },
  {
    kind: 'classification',
    async prepare(author, course) {
      const suffix = crypto.randomUUID();
      const name = (label: string) => `${label} ${suffix}`;
      const created = await ok(
        await author.post(course.apiPath('/node-types'), {
          data: { name: name('Lecturas'), icon: 'BookOpen', color: '#024AD8' },
        }),
        201,
      );
      const typeId = (await created.json()).nodeType.id;
      await ok(
        await author.post(course.apiPath('/nodes'), {
          data: { title: name('Nodo'), nodeTypeId: typeId, positionX: 2000, positionY: 0 },
        }),
        201,
      );
      return {
        notices: async (api) =>
          (await listNotices(api, { roadmapId: course.roadmapId, read: false, limit: 100 })).filter(
            (notice) => notice.data.changeKind === 'classification-updated',
          ),
        change: async (value) =>
          ok(
            await author.patch(course.apiPath(`/node-types/${typeId}`), {
              data: { name: name(value) },
            }),
          ),
        known: 'Lecturas',
        values: ['Guías', 'Guías nuevas', 'Pautas', 'Pautas nuevas'],
        absorbed: (notice) => notice.data.nextTypeName,
        absorbedValue: name('Guías nuevas'),
        absorbedBody: `El tipo «${name('Lecturas')}» ahora se llama «${name('Guías nuevas')}».`,
        restartedBody: `El tipo «${name('Pautas')}» ahora se llama «${name('Pautas nuevas')}».`,
      };
    },
  },
];

for (const { kind, prepare } of kinds)
  test.describe(`${kind} notice`, () => {
    test('absorbs changes, withdraws a return to known and restarts after recognition', async ({
      course,
      teacherApi: author,
      studentApi: recipient,
    }) => {
      const subject = await prepare(author, course);
      const [first, second, restart, later] = subject.values;
      const notices = () => subject.notices(recipient);
      // eslint-disable-next-line playwright/no-conditional-in-test
      if (subject.createdPending) {
        // eslint-disable-next-line playwright/no-conditional-expect
        await expect.poll(notices).toHaveLength(1);
        await recognize(recipient, course.roadmapId);
      }
      await subject.change(first);
      await expect.poll(notices).toHaveLength(1);
      const firstId = (await notices())[0].id;
      await subject.change(second);
      await expect
        .poll(async () => {
          const notice = (await notices())[0];
          return notice && subject.absorbed(notice);
        })
        .toBe(subject.absorbedValue);
      expect(await notices()).toMatchObject([{ id: firstId, body: subject.absorbedBody }]);
      expect(await subject.notices(author)).toHaveLength(0);
      await subject.change(subject.known);
      await expect.poll(notices).toHaveLength(0);
      await subject.change(restart);
      await expect.poll(notices).toHaveLength(1);
      await recognize(recipient, course.roadmapId);
      await subject.change(later);
      await expect.poll(notices).toHaveLength(1);
      expect((await notices())[0].body).toBe(subject.restartedBody);
    });
  });
