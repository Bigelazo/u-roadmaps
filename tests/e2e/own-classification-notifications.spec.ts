import { execFileSync } from 'node:child_process';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { fixture, roadmapPath, sessionCookie, authenticateAs } from './helpers';

type Notice = {
  id: string;
  subject: string;
  body: string;
  read: boolean;
  data: Record<string, unknown>;
};

function fixtureSql(sql: string) {
  const url = new URL(process.env.E2E_DATABASE_URL!);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/roadmap_e2e_db'
  )
    throw new Error('Expected the local E2E database.');
  return execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8',
    timeout: 15_000,
    env: {
      ...process.env,
      PGDATABASE: 'roadmap_e2e_db',
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
    },
  });
}

async function deleteTestContent(
  request: APIRequestContext,
  headers: { cookie: string },
  nodeIds: readonly string[],
  typeId?: string,
) {
  for (const id of nodeIds) await request.delete(roadmapPath(`/nodes/${id}`), { headers });
  if (typeId) await request.delete(roadmapPath(`/node-types/${typeId}`), { headers });
  for (const id of nodeIds)
    fixtureSql(`DELETE FROM "RoadmapNotice" WHERE "data"->>'nodeId' = '${id}';`);
}

test('used Type renames deliver one general notice across Sections and recognize separately from Nodes', async ({
  request,
  page,
}) => {
  const author = { cookie: await sessionCookie(fixture.daniela) };
  const student = fixture.cc1002StudentWithoutProgress;
  const otherSection = fixture.cc1002StudentComplete;
  const roadmap = await (await request.get(roadmapPath(), { headers: author })).json();
  const suffix = crypto.randomUUID();
  const outsider = crypto.randomUUID();
  const before = `Lecturas ${suffix}`;
  const after = `Guías ${suffix}`;
  let typeId: string | undefined;
  const nodeIds: string[] = [];
  const notices = async (userId: string = student) => {
    const response = await request.get(
      `/api/notifications?roadmapId=${roadmap.roadmap.id}&limit=100`,
      {
        headers: { cookie: await sessionCookie(userId) },
      },
    );
    expect(response.status()).toBe(200);
    return (await response.json()).notifications as Notice[];
  };
  const classification = async (userId: string = student) =>
    (await notices(userId)).filter((n) => n.data.nextTypeName === after);
  const patch = async (data: Record<string, unknown>) => {
    const response = await request.patch(roadmapPath(`/node-types/${typeId}`), {
      headers: author,
      data,
    });
    expect(response.status()).toBe(200);
    return response;
  };
  fixtureSql(
    `INSERT INTO "User" ("id", "name", "institutionalEmail") VALUES ('${outsider}', 'Usuario ajeno', '${outsider}@u-roadmaps.test');`,
  );
  try {
    const anonymous = await request.patch(roadmapPath(`/node-types/${roadmap.nodeTypes[0].id}`), {
      data: { name: before },
    });
    expect(anonymous.status()).toBe(401);
    const created = await request.post(roadmapPath('/node-types'), {
      headers: author,
      data: { name: before, icon: 'BookOpen', color: '#024AD8' },
    });
    expect(created.status()).toBe(201);
    typeId = (await created.json()).nodeType.id;
    await patch({ name: after });
    expect(await classification()).toHaveLength(0);
    await patch({ name: before });
    for (const isVisible of [true, true, false]) {
      const response = await request.post(roadmapPath('/nodes'), {
        headers: author,
        data: {
          title: `Nodo ${suffix} ${nodeIds.length}`,
          nodeTypeId: typeId,
          positionX: 2000 + nodeIds.length * 320,
          positionY: 0,
          isVisible,
        },
      });
      expect(response.status()).toBe(201);
      nodeIds.push((await response.json()).node.id);
    }
    await patch({ icon: 'GraduationCap' });
    await patch({ color: '#1467A8' });
    expect(await classification()).toHaveLength(0);
    const forbidden = await request.patch(roadmapPath(`/node-types/${typeId}`), {
      headers: { cookie: await sessionCookie(student) },
      data: { name: after },
    });
    expect(forbidden.status()).toBe(403);
    await patch({ name: after });
    await expect.poll(() => classification()).toHaveLength(1);
    for (const userId of [otherSection, fixture.nicolas, fixture.camila])
      expect(await classification(userId)).toHaveLength(1);
    for (const userId of [fixture.daniela, fixture.cc1002WithdrawnStudent, outsider])
      expect(await classification(userId)).toHaveLength(0);
    const notice = (await classification())[0];
    expect(notice).toMatchObject({
      subject: `Tipo «${before}» → «${after}»`,
      body: expect.stringContaining('actualizó la clasificación del Roadmap de CC1002'),
      read: false,
      data: {
        targetKind: 'roadmap',
        changeKind: 'classification-updated',
        previousTypeName: before,
        nextTypeName: after,
      },
    });
    expect(notice.data.nodeId).toBeUndefined();
    const count = await request.get(`/api/notifications/counts?roadmapId=${roadmap.roadmap.id}`, {
      headers: { cookie: await sessionCookie(student) },
    });
    expect((await count.json()).count).toBeGreaterThan(0);
    await authenticateAs(page.context(), student);
    await page.goto('/academic-overview');
    await expect(page.getByRole('button', { name: /^Avisos, .* sin leer$/ })).toBeVisible();
    await expect(
      page.getByLabel(/avisos sin leer para el curso Introducción a la Programación/),
    ).toBeVisible();
    await page.getByRole('button', { name: /^Avisos(,|$)/ }).click();
    await page
      .getByRole('list', { name: 'Lista de avisos' })
      .getByRole('button')
      .filter({ hasText: notice.subject })
      .click();
    await expect(page).toHaveURL(/\/courses\/CC1002\/2026\/2\?notice=/);
    await expect(page).not.toHaveURL(/targetNode=/);
    await expect(page.getByRole('dialog', { name: notice.subject })).toBeVisible();
    await expect.poll(async () => (await classification())[0].read).toBe(true);
    const pendingNodes = (await notices()).filter(
      (n) => nodeIds.includes(String(n.data.nodeId)) && n.data.targetKind === 'node',
    );
    expect(pendingNodes.length).toBeGreaterThan(0);
    expect(pendingNodes.every((n) => !n.read)).toBe(true);
    await page.getByRole('button', { name: 'Entendido' }).click();
    const reassigned = await request.patch(roadmapPath(`/nodes/${nodeIds[0]}`), {
      headers: author,
      data: { nodeTypeId: roadmap.nodeTypes[0].id },
    });
    expect(reassigned.status()).toBe(200);
    expect(await classification()).toHaveLength(1);
    expect(
      (await notices()).some(
        (n) => n.data.nodeId === nodeIds[0] && n.data.changeKind === 'node-updated',
      ),
    ).toBe(true);
    for (const id of nodeIds.slice(0, 2)) {
      expect(
        (
          await request.patch(roadmapPath(`/nodes/${id}`), {
            headers: author,
            data: { isVisible: false },
          })
        ).status(),
      ).toBe(200);
    }
    await patch({ name: `Oculto ${suffix}` });
    expect(
      (await notices()).filter((n) => n.data.nextTypeName === `Oculto ${suffix}`),
    ).toHaveLength(0);
  } finally {
    await deleteTestContent(request, author, nodeIds, typeId);
    fixtureSql(`DELETE FROM "User" WHERE "id" = '${outsider}';`);
    fixtureSql(
      `DELETE FROM "RoadmapNotice" WHERE "data"->>'nextTypeName' LIKE '%${suffix}' OR "data"->>'nodeId' IN (${nodeIds.map((id) => `'${id}'`).join(',') || 'NULL'});`,
    );
  }
});

test('a PostgreSQL classification-notice failure preserves the confirmed Type rename', async ({
  request,
}) => {
  const author = { cookie: await sessionCookie(fixture.daniela) };
  const suffix = crypto.randomUUID().replaceAll('-', '');
  const nextName = `Renombre ${suffix}`;
  const triggerName = `e2e_fail_classification_${suffix}`;
  const functionName = `e2e_fail_classification_fn_${suffix}`;
  const sequence = `e2e_classification_attempts_${suffix}`;
  let typeId: string | undefined;
  let nodeId: string | undefined;
  try {
    const created = await request.post(roadmapPath('/node-types'), {
      headers: author,
      data: { name: `Antes ${suffix}`, icon: 'BookOpen', color: '#024AD8' },
    });
    expect(created.status()).toBe(201);
    typeId = (await created.json()).nodeType.id;
    const node = await request.post(roadmapPath('/nodes'), {
      headers: author,
      data: { title: `Nodo ${suffix}`, nodeTypeId: typeId, positionX: 4000, positionY: 0 },
    });
    expect(node.status()).toBe(201);
    nodeId = (await node.json()).node.id;
    fixtureSql(`CREATE SEQUENCE "${sequence}" START WITH 1;
      CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."data"->>'changeKind' = 'classification-updated'
          AND NEW."data"->>'nextTypeName' = '${nextName}' THEN
          PERFORM nextval('${sequence}');
          RAISE EXCEPTION 'E2E classification notice failure';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "RoadmapNotice"
      FOR EACH ROW EXECUTE FUNCTION "${functionName}"();`);
    const renamed = await request.patch(roadmapPath(`/node-types/${typeId}`), {
      headers: author,
      data: { name: nextName },
    });
    expect(renamed.status()).toBe(200);
    expect((await renamed.json()).nodeType.name).toBe(nextName);
    const persisted = await request.get(roadmapPath(), { headers: author });
    expect((await persisted.json()).nodeTypes).toContainEqual(
      expect.objectContaining({ id: typeId, name: nextName }),
    );
    expect(fixtureSql(`SELECT is_called::text FROM "${sequence}";`)).toContain('true');
    const inbox = await request.get('/api/notifications?limit=100', {
      headers: { cookie: await sessionCookie(fixture.cc1002StudentWithoutProgress) },
    });
    expect(
      (await inbox.json()).notifications.some((n: Notice) => n.data.nextTypeName === nextName),
    ).toBe(false);
  } finally {
    fixtureSql(
      `DROP TRIGGER IF EXISTS "${triggerName}" ON "RoadmapNotice"; DROP FUNCTION IF EXISTS "${functionName}"(); DROP SEQUENCE IF EXISTS "${sequence}";`,
    );
    await deleteTestContent(request, author, nodeId ? [nodeId] : [], typeId);
  }
});
