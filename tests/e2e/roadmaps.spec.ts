import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test';
import { SignJWT } from 'jose';
import { authenticateAs, fixture, fixtureRoadmapPath, roadmapPath, sessionCookie } from './helpers';

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID().slice(0, 8)}`;
}

async function deleteIfPresent(api: APIRequestContext, path: string | undefined) {
  if (path) await api.delete(path);
}

test('fixture participants receive their authorized roadmap representation', async ({
  request,
}, testInfo) => {
  const anonymous = await request.get(roadmapPath());
  expect(anonymous.status()).toBe(401);

  const teacher = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.teacher) },
  });
  const teacherRoadmap = await teacher.get(roadmapPath());
  expect(teacherRoadmap.status()).toBe(200);
  expect(await teacherRoadmap.json()).toEqual(
    expect.objectContaining({
      course: expect.objectContaining({ code: 'CC1001', name: 'Programación I' }),
      nodes: expect.arrayContaining([expect.objectContaining({ title: 'Cierre del curso' })]),
    }),
  );
  await teacher.dispose();

  const student = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.studentWithoutProgress) },
  });
  const studentRoadmap = await student.get(roadmapPath());
  expect(studentRoadmap.status()).toBe(200);
  const studentDto = await studentRoadmap.json();
  expect(studentDto.nodes).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ id: fixture.programming.hiddenNode })]),
  );
  const mutation = await student.patch(roadmapPath(`/nodes/${fixture.programming.firstNode}`), {
    data: { title: 'No autorizado' },
  });
  expect(mutation.status()).toBe(403);
  await student.dispose();

  const inactive = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.inactiveStudent) },
  });
  expect((await inactive.get(roadmapPath())).status()).toBe(403);
  await inactive.dispose();
});

test('roadmap creation rejects conflicts and preserves authorization and cross-roadmap boundaries', async ({
  request,
}, testInfo) => {
  const teacher = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.teacher) },
  });
  const conflict = await teacher.post(roadmapPath(), {
    data: { course: { name: 'Programación I', department: 'DCC' } },
  });
  expect(conflict.status()).toBe(409);
  expect((await conflict.json()).error.code).toBe('ROADMAP_CONFLICT');
  expect((await teacher.post(fixtureRoadmapPath(fixture.physics))).status()).toBe(403);
  await teacher.dispose();

  const student = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.studentWithoutProgress) },
  });
  expect((await student.get(fixtureRoadmapPath(fixture.physics))).status()).toBe(404);
  expect((await student.post(roadmapPath())).status()).toBe(403);
  const foreignResource = await student.get(
    fixtureRoadmapPath(fixture.calculus, `/nodes/${fixture.programming.firstNode}/resources`),
  );
  expect(foreignResource.status()).toBe(404);
  expect((await foreignResource.json()).error.code).toBe('NODE_NOT_FOUND');
  await student.dispose();
  expect((await request.get(roadmapPath())).status()).toBe(401);
});

test('teacher API manages a node type, resources, and dependencies through their lifecycle', async ({}, testInfo) => {
  const api = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.teacher) },
  });
  const typeName = uniqueName('Laboratorio E2E');
  let typeId: string | undefined;
  let sourceId: string | undefined;
  let targetId: string | undefined;
  let resourceId: string | undefined;
  let dependencyId: string | undefined;
  try {
    const createdType = await api.post(roadmapPath('/node-types'), {
      data: { name: typeName, color: '#abcdef' },
    });
    expect(createdType.status()).toBe(201);
    typeId = (await createdType.json()).nodeType.id;
    expect(
      (
        await api.post(roadmapPath('/node-types'), { data: { name: typeName, color: '#ABCDEF' } })
      ).status(),
    ).toBe(409);
    expect(
      (
        await api.patch(roadmapPath(`/node-types/${typeId}`), {
          data: { name: `${typeName} actualizado`, color: '#123456' },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await api.patch(roadmapPath('/node-types/00000000-0000-4000-8000-000000000001'), {
          data: { name: 'No modificable' },
        })
      ).status(),
    ).toBe(409);

    const sourceResponse = await api.post(roadmapPath('/nodes'), {
      data: { title: uniqueName('Origen E2E'), nodeTypeId: typeId, positionX: 0, positionY: 0 },
    });
    const targetResponse = await api.post(roadmapPath('/nodes'), {
      data: { title: uniqueName('Destino E2E'), nodeTypeId: typeId, positionX: 120, positionY: 0 },
    });
    expect(sourceResponse.status()).toBe(201);
    expect(targetResponse.status()).toBe(201);
    sourceId = (await sourceResponse.json()).node.id;
    targetId = (await targetResponse.json()).node.id;
    expect((await api.delete(roadmapPath(`/node-types/${typeId}`))).status()).toBe(409);

    const resource = await api.post(roadmapPath(`/nodes/${sourceId}/resources`), {
      data: { title: 'Guía E2E', url: 'https://example.test/e2e-guide', type: 'LINK' },
    });
    expect(resource.status()).toBe(201);
    resourceId = (await resource.json()).resource.id;
    expect(
      (
        await api.patch(roadmapPath(`/resources/${resourceId}`), {
          data: { title: 'Video E2E', type: 'VIDEO' },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await api.post(roadmapPath(`/nodes/${sourceId}/resources`), {
          data: { title: 'Unsafe', url: 'javascript:alert(1)', type: 'LINK' },
        })
      ).status(),
    ).toBe(400);

    const dependency = await api.post(roadmapPath('/dependencies'), {
      data: {
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        sourceHandle: 'bottom',
        targetHandle: 'top',
      },
    });
    expect(dependency.status()).toBe(201);
    dependencyId = (await dependency.json()).dependency.id;
    expect(
      (
        await api.post(roadmapPath('/dependencies'), {
          data: { sourceNodeId: targetId, targetNodeId: sourceId },
        })
      ).status(),
    ).toBe(409);
    expect((await api.delete(roadmapPath(`/dependencies/${dependencyId}`))).status()).toBe(204);
    dependencyId = undefined;
    expect((await api.delete(roadmapPath(`/resources/${resourceId}`))).status()).toBe(204);
    resourceId = undefined;
  } finally {
    await deleteIfPresent(api, dependencyId && roadmapPath(`/dependencies/${dependencyId}`));
    await deleteIfPresent(api, resourceId && roadmapPath(`/resources/${resourceId}`));
    await deleteIfPresent(api, sourceId && roadmapPath(`/nodes/${sourceId}`));
    await deleteIfPresent(api, targetId && roadmapPath(`/nodes/${targetId}`));
    await deleteIfPresent(api, typeId && roadmapPath(`/node-types/${typeId}`));
    await api.dispose();
  }
});

test('completion ignores hidden prerequisites and requires an active student participation', async ({}, testInfo) => {
  const teacher = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.teacher) },
  });
  const student = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.studentWithoutProgress) },
  });
  const inactive = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.inactiveStudent) },
  });
  let hiddenId: string | undefined;
  let prerequisiteId: string | undefined;
  let targetId: string | undefined;
  let dependencyId: string | undefined;
  try {
    const hidden = await teacher.post(roadmapPath('/nodes'), {
      data: {
        title: uniqueName('Prerequisito oculto E2E'),
        nodeTypeId: '00000000-0000-4000-8000-000000000001',
        positionX: 0,
        positionY: 0,
        isVisible: false,
      },
    });
    const target = await teacher.post(roadmapPath('/nodes'), {
      data: {
        title: uniqueName('Objetivo visible E2E'),
        nodeTypeId: '00000000-0000-4000-8000-000000000001',
        positionX: 120,
        positionY: 0,
      },
    });
    expect(hidden.status()).toBe(201);
    expect(target.status()).toBe(201);
    hiddenId = (await hidden.json()).node.id;
    targetId = (await target.json()).node.id;
    const prerequisite = await teacher.post(roadmapPath('/nodes'), {
      data: {
        title: uniqueName('Prerequisito visible E2E'),
        nodeTypeId: '00000000-0000-4000-8000-000000000001',
        positionX: 60,
        positionY: 0,
      },
    });
    expect(prerequisite.status()).toBe(201);
    prerequisiteId = (await prerequisite.json()).node.id;
    const dependency = await teacher.post(roadmapPath('/dependencies'), {
      data: { sourceNodeId: hiddenId, targetNodeId: targetId },
    });
    expect(dependency.status()).toBe(201);
    dependencyId = (await dependency.json()).dependency.id;
    const visibleDependency = await teacher.post(roadmapPath('/dependencies'), {
      data: { sourceNodeId: prerequisiteId, targetNodeId: targetId },
    });
    expect(visibleDependency.status()).toBe(201);
    expect((await student.post(roadmapPath(`/nodes/${hiddenId}/completion`))).status()).toBe(404);
    expect((await student.post(roadmapPath(`/nodes/${targetId}/completion`))).status()).toBe(409);
    expect((await student.post(roadmapPath(`/nodes/${prerequisiteId}/completion`))).status()).toBe(
      200,
    );
    expect((await student.post(roadmapPath(`/nodes/${targetId}/completion`))).status()).toBe(200);
    expect((await student.post(roadmapPath(`/nodes/${targetId}/completion`))).status()).toBe(200);
    expect(
      (
        await teacher.post(roadmapPath(`/nodes/${fixture.programming.firstNode}/completion`))
      ).status(),
    ).toBe(403);
    expect(
      (
        await inactive.post(roadmapPath(`/nodes/${fixture.programming.firstNode}/completion`))
      ).status(),
    ).toBe(403);
  } finally {
    await deleteIfPresent(teacher, dependencyId && roadmapPath(`/dependencies/${dependencyId}`));
    await deleteIfPresent(teacher, targetId && roadmapPath(`/nodes/${targetId}`));
    await deleteIfPresent(teacher, prerequisiteId && roadmapPath(`/nodes/${prerequisiteId}`));
    await deleteIfPresent(teacher, hiddenId && roadmapPath(`/nodes/${hiddenId}`));
    await Promise.all([teacher.dispose(), student.dispose(), inactive.dispose()]);
  }
});

test('teacher and student workflows render against the shared fixture', async ({
  page,
}, testInfo) => {
  await authenticateAs(page.context(), fixture.teacher);
  await page.goto('/courses/CC1001/2026/2');
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Programación I' })).toBeVisible();
  const nodeTitle = uniqueName('Nodo creado desde E2E');
  const api = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.teacher) },
  });
  let nodeId: string | undefined;
  try {
    await page.getByLabel('Título del nodo').fill(nodeTitle);
    await page.getByRole('button', { name: 'Agregar nodo' }).click();
    await expect(page.locator('p', { hasText: nodeTitle })).toBeVisible();
    const roadmap = await api.get(roadmapPath());
    nodeId = (await roadmap.json()).nodes.find(
      (node: { title: string }) => node.title === nodeTitle,
    )?.id;
    expect(nodeId).toBeTruthy();

    await page.context().clearCookies();
    await authenticateAs(page.context(), fixture.studentWithProgress);
    await page.goto('/academic-overview');
    await expect(page.getByRole('heading', { name: 'Hola, Estudiante 02' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Cursos actuales' }).getByRole('listitem'),
    ).toHaveCount(3);
    await expect(
      page.getByRole('region', { name: 'Historial académico' }).getByRole('listitem'),
    ).toHaveCount(1);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('link', { name: 'Abrir roadmap' }).first()).toBeVisible();
    expect(
      await page.locator('main').evaluate((main) => main.scrollWidth <= main.clientWidth),
    ).toBe(true);
    await page.getByRole('link', { name: 'Abrir roadmap' }).first().click();
    await page.getByText('Variables y tipos').click();
    await expect(page.getByRole('link', { name: 'Guía de variables' })).toHaveAttribute(
      'href',
      'https://example.test/programacion/variables',
    );
    await expect(page.getByRole('button', { name: 'Completar' })).toBeEnabled();
  } finally {
    await deleteIfPresent(api, nodeId && roadmapPath(`/nodes/${nodeId}`));
    await api.dispose();
  }
});

test('academic overview explains when there are no active course participations', async ({
  page,
}) => {
  await authenticateAs(page.context(), fixture.inactiveStudent);
  await page.goto('/academic-overview');

  await expect(page.getByRole('heading', { name: 'Hola, Estudiante 51' })).toBeVisible();
  await expect(page.getByText('No hay cursos para mostrar', { exact: true })).toBeVisible();
  await expect(page.getByText('No tienes participaciones activas en cursos.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Abrir roadmap|Ver curso/ })).toHaveCount(0);
});

async function vtiToken(
  claims: Record<string, unknown>,
  secret = process.env.VTI_JWT_SECRET ?? 'e2e-vti-secret',
  algorithm = 'HS256',
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime('5m')
    .setIssuer(process.env.VTI_JWT_ISSUER ?? 'https://vti.example.test')
    .setAudience(process.env.VTI_JWT_AUDIENCE ?? 'u-roadmaps')
    .sign(new TextEncoder().encode(secret));
}

test('VTI callback rejects missing state, invalid tokens, and incomplete claims', async ({
  request,
}) => {
  const validToken = await vtiToken({
    identification: `0000${Date.now()}-5`,
    email: `${crypto.randomUUID()}@example.test`,
    name: 'Persona VTI inválida',
  });
  const missingState = await request.post('/api/plogin', {
    maxRedirects: 0,
    form: { jwt: validToken },
  });
  expect(missingState.status()).toBe(307);
  expect(missingState.headers().location).toContain('/?error=Authentication');

  for (const token of [
    'not-a-jwt',
    await vtiToken(
      {
        identification: `0000${Date.now()}-5`,
        email: `${crypto.randomUUID()}@example.test`,
        name: 'Firma inválida',
      },
      'wrong-secret',
    ),
    await vtiToken(
      {
        identification: `0000${Date.now()}-5`,
        email: `${crypto.randomUUID()}@example.test`,
        name: 'Algoritmo inválido',
      },
      process.env.VTI_JWT_SECRET ?? 'e2e-vti-secret',
      'HS384',
    ),
    await vtiToken({ email: `${crypto.randomUUID()}@example.test`, name: 'Sin identificación' }),
    await vtiToken({ identification: `0000${Date.now()}-5`, name: 'Sin correo' }),
    await vtiToken({
      identification: `0000${Date.now()}-5`,
      email: `${crypto.randomUUID()}@example.test`,
    }),
  ]) {
    const start = await request.get('/api/plogin/start', { maxRedirects: 0 });
    const state = new URL(start.headers().location).searchParams.get('state');
    const stateCookie = start.headers()['set-cookie'].split(';', 1)[0];
    const callback = await request.post('/api/plogin', {
      maxRedirects: 0,
      headers: { cookie: stateCookie, 'content-type': 'application/x-www-form-urlencoded' },
      form: { jwt: token, state: state ?? '' },
    });
    expect(callback.status()).toBe(307);
    expect(callback.headers().location).toContain('/?error=Authentication');
  }
});

test('landing access starts VTI and dismisses authentication failures without reloading', async ({
  page,
  request,
}) => {
  await page.goto('/?error=Authentication');
  await expect(
    page.getByRole('alert', { name: 'No fue posible completar la autenticación institucional.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ingresar con U-Pasaporte' })).toHaveAttribute(
    'href',
    '/api/plogin/start',
  );
  await expect(page.getByRole('list', { name: 'Ruta de aprendizaje de ejemplo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Funciones', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar alerta' }).click();
  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('alert', { name: 'No fue posible completar la autenticación institucional.' }),
  ).toHaveCount(0);

  const protectedRoute = await request.get('/academic-overview', { maxRedirects: 0 });
  expect(protectedRoute.status()).toBe(307);
  expect(protectedRoute.headers().location).toContain('/api/plogin/start');
});

test('1440px visual references cover the public shell states in each browser', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  expect(page.viewportSize()).toEqual({ width: 1440, height: 960 });

  await page.goto('/');
  await testInfo.attach('anonymous-landing', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  await page.goto('/?error=Authentication');
  await expect(
    page.getByRole('alert', { name: 'No fue posible completar la autenticación institucional.' }),
  ).toBeVisible();
  await testInfo.attach('authentication-error-landing', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  await authenticateAs(page.context(), fixture.studentWithoutProgress);
  await page.goto('/academic-overview');
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await testInfo.attach('authenticated-navigation', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('VTI callback issues a session after validating its one-time state', async ({
  request,
}, testInfo) => {
  const start = await request.get('/api/plogin/start', { maxRedirects: 0 });
  expect(start.status()).toBe(307);
  const state = new URL(start.headers().location).searchParams.get('state');
  expect(state).toBeTruthy();
  const stateCookie = start.headers()['set-cookie'].split(';', 1)[0];
  const token = await vtiToken(fixture.studentWithoutProgressVtiClaims);
  const callback = await request.post('/api/plogin', {
    maxRedirects: 0,
    headers: { cookie: stateCookie, 'content-type': 'application/x-www-form-urlencoded' },
    form: { jwt: token, state: state ?? '' },
  });
  expect(callback.status()).toBe(307);
  expect(callback.headers().location).toBe(
    new URL('/', testInfo.project.use.baseURL as string).toString(),
  );
  const sessionCookieValue = callback.headers()['set-cookie'].split(';', 1)[0];
  const session = await request.get('/api/auth/session', {
    headers: { cookie: sessionCookieValue },
  });
  expect(await session.json()).toEqual(
    expect.objectContaining({
      user: expect.objectContaining({ id: fixture.studentWithoutProgress }),
    }),
  );
});
