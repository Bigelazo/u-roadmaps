import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import test from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { encode } from 'next-auth/jwt';
import { SignJWT } from 'jose';
import { PrismaClient } from '../src/generated/prisma/client';

const port = 3100 + (process.pid % 500);
const baseUrl = `http://localhost:${port}`;
const suffix = Date.now().toString();
const courseOffering = { courseCode: `CC${suffix}`, year: 2026, semester: 1 };
const otherCourseOffering = { courseCode: `CI${suffix}`, year: 2026, semester: 1 };
const predefinedNodeTypeId = '00000000-0000-4000-8000-000000000001';
const authSecret = process.env.NEXTAUTH_SECRET ?? 'integration-nextauth-secret';
const vtiSecret = process.env.VTI_JWT_SECRET ?? 'integration-vti-secret';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
let server: ChildProcess;
let teacherCookie = '';
let studentCookie = '';

function serialTest(name: string, callback: () => void | Promise<void>) {
  return test(name, { concurrency: false }, callback);
}

function roadmapUrl(identifier: typeof courseOffering, suffixPath = '') {
  return `${baseUrl}/api/${encodeURIComponent(identifier.courseCode)}/${identifier.year}/${identifier.semester}/roadmap${suffixPath}`;
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(baseUrl)).ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('Next.js no inició dentro del tiempo esperado.');
}

async function sessionCookie(userId: string) {
  const value = await encode({ token: { sub: userId }, secret: authSecret });
  return `next-auth.session-token=${value}`;
}

async function authFetch(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: { cookie: teacherCookie, ...(init.headers ?? {}) } });
}

async function request(
  url: string,
  method: string,
  body?: Record<string, unknown>,
  cookie = teacherCookie,
) {
  return fetch(url, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function signVtiToken(
  claims: Record<string, unknown>,
  secret = vtiSecret,
  algorithm = 'HS256',
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret));
}

function startServer(nextAuthUrl = baseUrl) {
  return spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(port)], {
    env: {
      ...process.env,
      DATABASE_URL:
        'postgresql://roadmap_test_user:roadmap_test_password@localhost:5433/roadmap_test_db',
      NEXTAUTH_URL: nextAuthUrl,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: 'ignore',
  });
}

test.before(async () => {
  const teacher = await prisma.user.create({
    data: {
      name: 'Docente de integración',
      institutionalEmail: `docente-${suffix}@uchile.cl`,
      rut: `9${suffix}`,
    },
  });
  teacherCookie = await sessionCookie(teacher.id);
  server = startServer();
  await waitForServer();
});

test.after(() => {
  server.kill('SIGTERM');
  return prisma.$disconnect();
});

serialTest('GET without a roadmap returns the stable not-found error', async () => {
  const unauthenticated = await fetch(roadmapUrl(courseOffering));
  assert.equal(unauthenticated.status, 401);

  const response = await authFetch(roadmapUrl(courseOffering));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'ROADMAP_NOT_FOUND');
});

serialTest('rejects an invalid session and a user without course participation', async () => {
  const invalidSession = await fetch(roadmapUrl(courseOffering), {
    headers: { cookie: 'next-auth.session-token=invalid' },
  });
  assert.equal(invalidSession.status, 401);
});

serialTest('creates and reads an academic roadmap as an English DTO', async () => {
  const created = await request(roadmapUrl(courseOffering), 'POST', {
    course: { name: 'Curso de prueba', department: 'DCC' },
  });
  assert.equal(created.status, 201);

  const persistedCourseOffering = await prisma.courseOffering.findUniqueOrThrow({
    where: { courseCode_year_semester: courseOffering },
  });
  const teacher = await prisma.user.findUniqueOrThrow({
    where: { institutionalEmail: `docente-${suffix}@uchile.cl` },
  });
  await prisma.participation.create({
    data: {
      userId: teacher.id,
      courseOfferingId: persistedCourseOffering.id,
      role: 'TEACHER',
    },
  });

  const conflict = await request(roadmapUrl(courseOffering), 'POST', {
    course: { name: 'Otro nombre', department: 'DCC' },
  });
  assert.equal(conflict.status, 409);

  const response = await authFetch(roadmapUrl(courseOffering));
  assert.equal(response.status, 200);
  const dto = await response.json();
  assert.deepEqual(dto.course, {
    code: courseOffering.courseCode,
    name: 'Curso de prueba',
    department: 'DCC',
  });
  assert.deepEqual(dto.nodes, []);
  assert.deepEqual(dto.dependencies, []);
  assert.equal('data' in dto, false);

  const outsider = await prisma.user.create({
    data: {
      name: 'Sin participación',
      institutionalEmail: `outsider-${suffix}@uchile.cl`,
      rut: `6${suffix}`,
    },
  });
  const outsiderResponse = await fetch(roadmapUrl(courseOffering), {
    headers: { cookie: await sessionCookie(outsider.id) },
  });
  assert.equal(outsiderResponse.status, 403);
  await prisma.participation.create({
    data: {
      userId: outsider.id,
      courseOfferingId: persistedCourseOffering.id,
      role: 'STUDENT',
      isActive: false,
    },
  });
  const inactiveResponse = await fetch(roadmapUrl(courseOffering), {
    headers: { cookie: await sessionCookie(outsider.id) },
  });
  assert.equal(inactiveResponse.status, 403);
});

serialTest('manages nodes, dependencies, custom types, and resources', async () => {
  const nodeTypeResponse = await request(roadmapUrl(courseOffering, '/node-types'), 'POST', {
    name: ' Laboratorio ',
    color: '#abcdef',
  });
  assert.equal(nodeTypeResponse.status, 201);
  const nodeType = (await nodeTypeResponse.json()).nodeType;
  assert.equal(
    (
      await request(roadmapUrl(courseOffering, '/node-types'), 'POST', {
        name: 'laboratorio',
        color: '#ABCDEF',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(roadmapUrl(courseOffering, '/node-types'), 'POST', {
        name: ' contenido ',
        color: '#abcdef',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(roadmapUrl(courseOffering, `/node-types/${nodeType.id}`), 'PATCH', {
        name: 'Práctica',
        color: '#123456',
      })
    ).status,
    200,
  );

  const firstNodeResponse = await request(roadmapUrl(courseOffering, '/nodes'), 'POST', {
    title: 'Primero',
    description: 'Detalle',
    nodeTypeId: nodeType.id,
    positionX: 0,
    positionY: 0,
  });
  const secondNodeResponse = await request(roadmapUrl(courseOffering, '/nodes'), 'POST', {
    title: 'Segundo',
    nodeTypeId: predefinedNodeTypeId,
    positionX: 120,
    positionY: 0,
  });
  assert.equal(firstNodeResponse.status, 201);
  assert.equal(secondNodeResponse.status, 201);
  const firstNode = (await firstNodeResponse.json()).node;
  const secondNode = (await secondNodeResponse.json()).node;
  assert.equal(
    (
      await request(roadmapUrl(courseOffering, `/node-types/${predefinedNodeTypeId}`), 'PATCH', {
        name: 'Otro',
      })
    ).status,
    409,
  );
  assert.equal(
    (await request(roadmapUrl(courseOffering, `/node-types/${nodeType.id}`), 'DELETE')).status,
    409,
  );

  const resourceResponse = await request(
    roadmapUrl(courseOffering, `/nodes/${firstNode.id}/resources`),
    'POST',
    { title: 'Guía', url: 'https://example.com/guide', type: 'LINK' },
  );
  assert.equal(resourceResponse.status, 201);
  const resource = (await resourceResponse.json()).resource;
  assert.equal('roadmapNodeId' in resource, false);
  assert.equal(
    (
      await request(roadmapUrl(courseOffering, `/resources/${resource.id}`), 'PATCH', {
        title: 'Guía actualizada',
        type: 'VIDEO',
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(roadmapUrl(courseOffering, `/resources/${resource.id}`), 'DELETE')).status,
    204,
  );
  const remainingResourceIds: string[] = [];
  for (const type of ['FILE', 'VIDEO']) {
    const remainingResource = await request(
      roadmapUrl(courseOffering, `/nodes/${firstNode.id}/resources`),
      'POST',
      { title: type, url: 'https://example.com/resource', type },
    );
    assert.equal(remainingResource.status, 201);
    remainingResourceIds.push((await remainingResource.json()).resource.id);
  }
  assert.equal(
    (
      await request(roadmapUrl(courseOffering, `/nodes/${firstNode.id}/resources`), 'POST', {
        title: 'Sin URL',
        type: 'LINK',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(roadmapUrl(courseOffering, `/nodes/${firstNode.id}/resources`), 'POST', {
        title: 'Unsafe',
        url: 'javascript:alert(1)',
        type: 'LINK',
      })
    ).status,
    400,
  );
  const updatedNodeResponse = await request(
    roadmapUrl(courseOffering, `/nodes/${firstNode.id}`),
    'PATCH',
    {
      title: 'Primero actualizado',
      description: 'Detalle',
      nodeTypeId: predefinedNodeTypeId,
      isVisible: false,
      positionX: 50,
      positionY: 60,
    },
  );
  assert.equal(updatedNodeResponse.status, 200);
  const updatedNode = (await updatedNodeResponse.json()).node;
  assert.deepEqual(
    {
      title: updatedNode.title,
      description: updatedNode.description,
      nodeTypeId: updatedNode.nodeTypeId,
      isVisible: updatedNode.isVisible,
      positionX: updatedNode.positionX,
      positionY: updatedNode.positionY,
    },
    {
      title: 'Primero actualizado',
      description: 'Detalle',
      nodeTypeId: predefinedNodeTypeId,
      isVisible: false,
      positionX: 50,
      positionY: 60,
    },
  );

  const dependencyResponse = await request(roadmapUrl(courseOffering, '/dependencies'), 'POST', {
    sourceNodeId: firstNode.id,
    targetNodeId: secondNode.id,
  });
  assert.equal(dependencyResponse.status, 201);
  const dependencyId = (await dependencyResponse.json()).dependency.id;
  assert.equal(
    (
      await request(roadmapUrl(courseOffering, '/dependencies'), 'POST', {
        sourceNodeId: firstNode.id,
        targetNodeId: firstNode.id,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(roadmapUrl(courseOffering, '/dependencies'), 'POST', {
        sourceNodeId: secondNode.id,
        targetNodeId: firstNode.id,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(roadmapUrl(courseOffering, '/dependencies'), 'POST', {
        sourceNodeId: firstNode.id,
        targetNodeId: secondNode.id,
      })
    ).status,
    409,
  );
  assert.equal(
    (await request(roadmapUrl(courseOffering, `/dependencies/${dependencyId}`), 'DELETE')).status,
    204,
  );
  assert.equal(
    (
      await request(roadmapUrl(courseOffering, '/dependencies'), 'POST', {
        sourceNodeId: firstNode.id,
        targetNodeId: secondNode.id,
      })
    ).status,
    201,
  );

  const dto = await (
    await fetch(roadmapUrl(courseOffering), { headers: { cookie: teacherCookie } })
  ).json();
  assert.deepEqual(
    dto.nodeTypes.find((item: { id: string }) => item.id === nodeType.id),
    {
      id: nodeType.id,
      name: 'Práctica',
      color: '#123456',
      isPredefined: false,
    },
  );
  assert.deepEqual(
    dto.nodes.find((item: { id: string }) => item.id === firstNode.id),
    {
      id: firstNode.id,
      title: 'Primero actualizado',
      description: 'Detalle',
      positionX: 50,
      positionY: 60,
      nodeTypeId: predefinedNodeTypeId,
      isVisible: false,
      resources: [
        {
          id: remainingResourceIds[0],
          title: 'FILE',
          url: 'https://example.com/resource',
          type: 'FILE',
        },
        {
          id: remainingResourceIds[1],
          title: 'VIDEO',
          url: 'https://example.com/resource',
          type: 'VIDEO',
        },
      ],
    },
  );
  assert.equal(dto.dependencies.length, 1);
  assert.equal(
    (await request(roadmapUrl(courseOffering, `/nodes/${firstNode.id}`), 'DELETE')).status,
    204,
  );
  const afterDelete = await (await authFetch(roadmapUrl(courseOffering))).json();
  assert.equal(afterDelete.nodes.length, 1);
  assert.equal(afterDelete.dependencies.length, 0);
  assert.equal(
    (await authFetch(roadmapUrl(courseOffering, `/nodes/${firstNode.id}/resources`))).status,
    404,
  );
  for (const resourceId of remainingResourceIds) {
    assert.equal(
      (await request(roadmapUrl(courseOffering, `/resources/${resourceId}`), 'DELETE')).status,
      404,
    );
  }
  assert.equal(
    (await request(roadmapUrl(courseOffering, `/node-types/${nodeType.id}`), 'DELETE')).status,
    204,
  );
});

serialTest('rejects cross-roadmap mutations for valid UUIDs', async () => {
  const created = await request(roadmapUrl(otherCourseOffering), 'POST', {
    course: { name: 'Otro curso', department: 'DCC' },
  });
  assert.equal(created.status, 201);

  const otherOffering = await prisma.courseOffering.findUniqueOrThrow({
    where: { courseCode_year_semester: otherCourseOffering },
  });
  const teacher = await prisma.user.findUniqueOrThrow({
    where: { institutionalEmail: `docente-${suffix}@uchile.cl` },
  });
  await prisma.participation.create({
    data: { userId: teacher.id, courseOfferingId: otherOffering.id, role: 'TEACHER' },
  });
  const foreignNode = await request(roadmapUrl(otherCourseOffering, '/nodes'), 'POST', {
    title: 'Ajeno',
    nodeTypeId: predefinedNodeTypeId,
    positionX: 0,
    positionY: 0,
  });
  const node = (await foreignNode.json()).node;
  const foreignResourceResponse = await request(
    roadmapUrl(otherCourseOffering, `/nodes/${node.id}/resources`),
    'POST',
    { title: 'Recurso ajeno', url: 'https://example.com/foreign', type: 'LINK' },
  );
  const foreignResource = (await foreignResourceResponse.json()).resource;

  const response = await request(
    roadmapUrl(courseOffering, `/resources/${foreignResource.id}`),
    'DELETE',
  );
  assert.equal(response.status, 404);
  const resources = await (
    await authFetch(roadmapUrl(otherCourseOffering, `/nodes/${node.id}/resources`))
  ).json();
  assert.equal(resources.resources.length, 1);
  assert.equal(
    (
      await request(roadmapUrl(courseOffering, `/nodes/${node.id}`), 'PATCH', {
        isVisible: false,
      })
    ).status,
    404,
  );
  const foreignNodeTypeResponse = await request(
    roadmapUrl(otherCourseOffering, '/node-types'),
    'POST',
    {
      name: 'Ajeno',
      color: '#123456',
    },
  );
  const foreignNodeType = (await foreignNodeTypeResponse.json()).nodeType;
  assert.equal(
    (
      await request(roadmapUrl(courseOffering, `/node-types/${foreignNodeType.id}`), 'PATCH', {
        name: 'Ajeno 2',
      })
    ).status,
    404,
  );
  const localDto = await (await authFetch(roadmapUrl(courseOffering))).json();
  assert.equal(
    (
      await request(roadmapUrl(courseOffering, '/dependencies'), 'POST', {
        sourceNodeId: node.id,
        targetNodeId: localDto.nodes[0].id,
      })
    ).status,
    404,
  );
});

serialTest('student sessions read only visible nodes and cannot mutate', async () => {
  const persistedCourseOffering = await prisma.courseOffering.findUniqueOrThrow({
    where: { courseCode_year_semester: courseOffering },
  });
  const student = await prisma.user.create({
    data: {
      name: 'Estudiante de integración',
      institutionalEmail: `estudiante-${suffix}@uchile.cl`,
      rut: `8${suffix}`,
    },
  });
  await prisma.participation.create({
    data: { userId: student.id, courseOfferingId: persistedCourseOffering.id, role: 'STUDENT' },
  });
  studentCookie = await sessionCookie(student.id);
  const hiddenResponse = await request(roadmapUrl(courseOffering, '/nodes'), 'POST', {
    title: 'Nodo oculto',
    nodeTypeId: predefinedNodeTypeId,
    positionX: 240,
    positionY: 0,
    isVisible: false,
  });
  assert.equal(hiddenResponse.status, 201);
  const hidden = (await hiddenResponse.json()).node;
  const studentRoadmap = await fetch(roadmapUrl(courseOffering), {
    headers: { cookie: studentCookie },
  });
  assert.equal(studentRoadmap.status, 200);
  const studentDto = await studentRoadmap.json();
  assert.equal(
    studentDto.nodes.some((node: { id: string }) => node.id === hidden.id),
    false,
  );
  const forbiddenMutation = await request(
    roadmapUrl(courseOffering, `/nodes/${hidden.id}`),
    'PATCH',
    { title: 'No permitido' },
    studentCookie,
  );
  assert.equal(forbiddenMutation.status, 403);
});

serialTest('VTI callback creates a local user and a compatible session cookie', async () => {
  const token = await signVtiToken({
    identification: '000012345678-5',
    email: `Vti-${suffix}@uchile.cl`,
    name: 'Persona VTI',
    preferred_username: 'persona.vti',
  });
  const response = await fetch(`${baseUrl}/api/plogin?jwt=${encodeURIComponent(token)}`, {
    redirect: 'manual',
  });
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get('location') ?? '').pathname, '/');
  assert.match(response.headers.get('set-cookie') ?? '', /next-auth\.session-token=/);
  assert.equal(response.headers.get('location')?.includes(token), false);
  const vtiSessionCookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { cookie: vtiSessionCookie ?? '' },
  });
  assert.equal(sessionResponse.status, 200);
  assert.equal(
    (await sessionResponse.json()).user.id,
    (
      await prisma.user.findUniqueOrThrow({
        where: { institutionalEmail: `vti-${suffix}@uchile.cl` },
      })
    ).id,
  );
  const user = await prisma.user.findUniqueOrThrow({
    where: { institutionalEmail: `vti-${suffix}@uchile.cl` },
  });
  assert.equal(user.name, 'Persona VTI');
  assert.equal(user.rut, '12345678');
  assert.equal(await prisma.participation.count({ where: { userId: user.id } }), 0);
});

serialTest('VTI callback uses the secure cookie contract behind HTTPS', async () => {
  const stopped = new Promise<void>((resolve) => server.once('exit', () => resolve()));
  server.kill('SIGTERM');
  await stopped;
  server = startServer(`https://localhost:${port}`);
  await waitForServer();
  const token = await signVtiToken({
    identification: '000012345679-5',
    email: `https-${suffix}@uchile.cl`,
    name: 'Persona HTTPS',
  });
  const response = await fetch(`${baseUrl}/api/plogin?jwt=${encodeURIComponent(token)}`, {
    redirect: 'manual',
  });
  assert.equal(response.status, 307);
  const cookie = response.headers.get('set-cookie') ?? '';
  assert.match(cookie, /__Secure-next-auth\.session-token=/);
  assert.match(cookie, /Secure/);
});

serialTest('login page exposes the configured institutional redirect', async () => {
  const response = await fetch(`${baseUrl}/auth/signin`);
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /Autenticarse con U-Pasaporte \/ VTI/);
  assert.match(body, /vti\.example\.test/);
});

serialTest(
  'VTI callback reuses email and RUT identities and rejects conflicts atomically',
  async () => {
    const byEmail = await prisma.user.create({
      data: {
        name: 'Nombre anterior',
        institutionalEmail: `existing-email-${suffix}@uchile.cl`,
        rut: `71${suffix}`,
      },
    });
    const emailToken = await signVtiToken({
      identification: `71${suffix}-5`,
      email: `EXISTING-EMAIL-${suffix}@uchile.cl`,
      name: 'Nombre actualizado',
    });
    const emailResponse = await fetch(
      `${baseUrl}/api/plogin?jwt=${encodeURIComponent(emailToken)}`,
      { redirect: 'manual' },
    );
    assert.equal(emailResponse.status, 307);
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: byEmail.id } })).name,
      'Nombre actualizado',
    );

    const byRut = await prisma.user.create({
      data: {
        name: 'Vinculación por RUT',
        institutionalEmail: `existing-rut-${suffix}@uchile.cl`,
        rut: `72${suffix}`,
      },
    });
    const rutToken = await signVtiToken({
      identification: `72${suffix}-5`,
      email: `new-email-${suffix}@uchile.cl`,
      name: 'Nombre desde RUT',
    });
    assert.equal(
      (
        await fetch(`${baseUrl}/api/plogin?jwt=${encodeURIComponent(rutToken)}`, {
          redirect: 'manual',
        })
      ).status,
      307,
    );
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: byRut.id } })).institutionalEmail,
      `existing-rut-${suffix}@uchile.cl`,
    );
    assert.equal(
      await prisma.user.count({
        where: { institutionalEmail: `new-email-${suffix}@uchile.cl` },
      }),
      0,
    );

    const emailConflict = await prisma.user.create({
      data: {
        name: 'Correo en conflicto',
        institutionalEmail: `conflict-email-${suffix}@uchile.cl`,
        rut: `73${suffix}`,
      },
    });
    const rutConflict = await prisma.user.create({
      data: {
        name: 'RUT en conflicto',
        institutionalEmail: `conflict-rut-${suffix}@uchile.cl`,
        rut: `74${suffix}`,
      },
    });
    const conflictToken = await signVtiToken({
      identification: `74${suffix}-5`,
      email: emailConflict.institutionalEmail,
      name: 'No debe persistir',
    });
    assert.equal(
      (
        await fetch(`${baseUrl}/api/plogin?jwt=${encodeURIComponent(conflictToken)}`, {
          redirect: 'manual',
        })
      ).status,
      307,
    );
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: emailConflict.id } })).name,
      'Correo en conflicto',
    );
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: rutConflict.id } })).name,
      'RUT en conflicto',
    );
  },
);

serialTest('VTI callback rejects missing, incorrectly signed, and non-HS256 tokens', async () => {
  assert.equal((await fetch(`${baseUrl}/api/plogin`, { redirect: 'manual' })).status, 307);
  const wrongSecret = await signVtiToken(
    { identification: '12345678-5', email: `wrong-${suffix}@uchile.cl`, name: 'Wrong' },
    'wrong-secret',
  );
  assert.equal(
    (
      await fetch(`${baseUrl}/api/plogin?jwt=${encodeURIComponent(wrongSecret)}`, {
        redirect: 'manual',
      })
    ).status,
    307,
  );
  const wrongAlgorithm = await signVtiToken(
    { identification: '12345678-5', email: `algorithm-${suffix}@uchile.cl`, name: 'Algorithm' },
    vtiSecret,
    'HS384',
  );
  assert.equal(
    (
      await fetch(`${baseUrl}/api/plogin?jwt=${encodeURIComponent(wrongAlgorithm)}`, {
        redirect: 'manual',
      })
    ).status,
    307,
  );
  for (const claims of [
    { email: `missing-identification-${suffix}@uchile.cl`, name: 'Missing identification' },
    { identification: '12345678-5', name: 'Missing email' },
    { identification: '12345678-5', email: `missing-name-${suffix}@uchile.cl` },
  ]) {
    const missingClaim = await signVtiToken(claims);
    assert.equal(
      (
        await fetch(`${baseUrl}/api/plogin?jwt=${encodeURIComponent(missingClaim)}`, {
          redirect: 'manual',
        })
      ).status,
      307,
    );
  }
});
