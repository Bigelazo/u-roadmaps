import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import test from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { encode } from 'next-auth/jwt';
import { SignJWT } from 'jose';

const port = 3100 + (process.pid % 500);
const baseUrl = `http://localhost:${port}`;
const suffix = Date.now().toString();
const path = { ramo: `CC${suffix}`, anio: 2026, semestre: 1 };
const otherPath = { ramo: `CI${suffix}`, anio: 2026, semestre: 1 };
const predefinedTypeId = '00000000-0000-4000-8000-000000000001';
let server: ChildProcess;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const authSecret = process.env.NEXTAUTH_SECRET ?? 'integration-nextauth-secret';
const vtiSecret = process.env.VTI_JWT_SECRET ?? 'integration-vti-secret';
let teacherCookie = '';
let studentCookie = '';

function serialTest(name: string, callback: () => void | Promise<void>) {
  return test(name, { concurrency: false }, callback);
}

function roadmapUrl(course: typeof path, suffixPath = '') {
  return `${baseUrl}/api/cursos/${encodeURIComponent(course.ramo)}/${course.anio}/${course.semestre}/roadmap${suffixPath}`;
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
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

async function jsonRequest(
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

test.before(async () => {
  const teacher = await prisma.usuario.create({
    data: {
      nombre: 'Docente de integración',
      correoInstitucional: `docente-${suffix}@uchile.cl`,
      rut: `9${suffix}`,
    },
  });
  teacherCookie = await sessionCookie(teacher.id);
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(port)], {
    env: {
      ...process.env,
      DATABASE_URL:
        'postgresql://roadmap_test_user:roadmap_test_password@localhost:5433/roadmap_test_db',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: 'ignore',
  });
  await waitForServer();
});

test.after(() => {
  server.kill('SIGTERM');
  return prisma.$disconnect();
});

serialTest('GET without a roadmap returns the stable not-found error', async () => {
  const unauthenticated = await fetch(roadmapUrl(path));
  assert.equal(unauthenticated.status, 401);
  const response = await authFetch(roadmapUrl(path));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'ROADMAP_NOT_FOUND');
});

serialTest('rejects an invalid session and a user without course participation', async () => {
  const invalidSession = await fetch(roadmapUrl(path), {
    headers: { cookie: 'next-auth.session-token=invalid' },
  });
  assert.equal(invalidSession.status, 401);
});

serialTest('creates and reads an academic roadmap as a domain DTO', async () => {
  const created = await jsonRequest(roadmapUrl(path), 'POST', {
    nombreRamo: 'Curso de prueba',
    departamento: 'DCC',
  });
  assert.equal(created.status, 201);
  const course = await prisma.curso.findUnique({
    where: {
      ramoCodigo_anio_semestre: { ramoCodigo: path.ramo, anio: path.anio, semestre: path.semestre },
    },
  });
  assert.ok(course);
  const teacher = await prisma.usuario.findFirstOrThrow({
    where: { correoInstitucional: { startsWith: 'docente-' } },
  });
  await prisma.participacion.create({
    data: { usuarioId: teacher.id, cursoId: course.id, funcion: 'DOCENTE' },
  });
  const conflict = await jsonRequest(roadmapUrl(path), 'POST', {
    nombreRamo: 'Otro nombre',
    departamento: 'DCC',
  });
  assert.equal(conflict.status, 409);

  const response = await authFetch(roadmapUrl(path));
  assert.equal(response.status, 200);
  const dto = await response.json();
  assert.equal(dto.ramo.codigo, path.ramo);
  assert.deepEqual(dto.nodos, []);
  assert.equal('data' in dto, false);
  assert.equal('edges' in dto, false);
  const outsider = await prisma.usuario.create({
    data: {
      nombre: 'Sin participación',
      correoInstitucional: `outsider-${suffix}@uchile.cl`,
      rut: `6${suffix}`,
    },
  });
  const outsiderResponse = await fetch(roadmapUrl(path), {
    headers: { cookie: await sessionCookie(outsider.id) },
  });
  assert.equal(outsiderResponse.status, 403);
  await prisma.participacion.create({
    data: { usuarioId: outsider.id, cursoId: course.id, funcion: 'ESTUDIANTE', vigente: false },
  });
  const inactiveResponse = await fetch(roadmapUrl(path), {
    headers: { cookie: await sessionCookie(outsider.id) },
  });
  assert.equal(inactiveResponse.status, 403);
});

serialTest('manages nodes, dependencies, custom types, and resources', async () => {
  const typeResponse = await jsonRequest(roadmapUrl(path, '/tipos'), 'POST', {
    nombre: ' Laboratorio ',
    color: '#abcdef',
  });
  assert.equal(typeResponse.status, 201);
  const type = (await typeResponse.json()).tipo;
  assert.equal(
    (
      await jsonRequest(roadmapUrl(path, '/tipos'), 'POST', {
        nombre: 'laboratorio',
        color: '#ABCDEF',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await jsonRequest(roadmapUrl(path, '/tipos'), 'POST', {
        nombre: ' contenido ',
        color: '#abcdef',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await jsonRequest(roadmapUrl(path, `/tipos/${type.id}`), 'PATCH', {
        nombre: 'Práctica',
        color: '#123456',
      })
    ).status,
    200,
  );

  const firstResponse = await jsonRequest(roadmapUrl(path, '/nodos'), 'POST', {
    titulo: 'Primero',
    typeId: type.id,
    posX: 0,
    posY: 0,
  });
  const secondResponse = await jsonRequest(roadmapUrl(path, '/nodos'), 'POST', {
    titulo: 'Segundo',
    typeId: predefinedTypeId,
    posX: 120,
    posY: 0,
  });
  assert.equal(firstResponse.status, 201);
  assert.equal(secondResponse.status, 201);
  const first = (await firstResponse.json()).nodo;
  const second = (await secondResponse.json()).nodo;
  assert.equal(
    (await jsonRequest(roadmapUrl(path, `/tipos/${predefinedTypeId}`), 'PATCH', { nombre: 'Otro' }))
      .status,
    409,
  );
  assert.equal((await jsonRequest(roadmapUrl(path, `/tipos/${type.id}`), 'DELETE')).status, 409);

  const resource = await jsonRequest(roadmapUrl(path, `/nodos/${first.id}/recursos`), 'POST', {
    titulo: 'Guía',
    url: 'https://example.com/guide',
    tipo: 'ENLACE',
  });
  assert.equal(resource.status, 201);
  const resourceBody = (await resource.json()).recurso;
  assert.equal('nodoId' in resourceBody, false);
  assert.equal(
    (
      await jsonRequest(roadmapUrl(path, `/recursos/${resourceBody.id}`), 'PATCH', {
        titulo: 'Guía actualizada',
        tipo: 'VIDEO',
      })
    ).status,
    200,
  );
  assert.equal(
    (await jsonRequest(roadmapUrl(path, `/recursos/${resourceBody.id}`), 'DELETE')).status,
    204,
  );
  const remainingResourceIds: string[] = [];
  for (const tipo of ['ARCHIVO', 'VIDEO']) {
    const remainingResource = await jsonRequest(
      roadmapUrl(path, `/nodos/${first.id}/recursos`),
      'POST',
      { titulo: tipo, url: 'https://example.com/resource', tipo },
    );
    assert.equal(remainingResource.status, 201);
    remainingResourceIds.push((await remainingResource.json()).recurso.id);
  }
  assert.equal(
    (
      await jsonRequest(roadmapUrl(path, `/nodos/${first.id}/recursos`), 'POST', {
        titulo: 'Sin URL',
        tipo: 'ENLACE',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await jsonRequest(roadmapUrl(path, `/nodos/${first.id}/recursos`), 'POST', {
        titulo: 'Unsafe',
        url: 'javascript:alert(1)',
        tipo: 'ENLACE',
      })
    ).status,
    400,
  );
  const updatedNodeResponse = await jsonRequest(roadmapUrl(path, `/nodos/${first.id}`), 'PATCH', {
    titulo: 'Primero actualizado',
    descripcion: 'Detalle',
    typeId: predefinedTypeId,
    visible: false,
    posX: 50,
    posY: 60,
  });
  assert.equal(updatedNodeResponse.status, 200);
  const updatedNode = (await updatedNodeResponse.json()).nodo;
  assert.deepEqual(
    {
      titulo: updatedNode.titulo,
      descripcion: updatedNode.descripcion,
      typeId: updatedNode.typeId,
      visible: updatedNode.visible,
      posX: updatedNode.posX,
      posY: updatedNode.posY,
    },
    {
      titulo: 'Primero actualizado',
      descripcion: 'Detalle',
      typeId: predefinedTypeId,
      visible: false,
      posX: 50,
      posY: 60,
    },
  );

  const dependency = await jsonRequest(roadmapUrl(path, '/dependencias'), 'POST', {
    sourceNodeId: first.id,
    targetNodeId: second.id,
  });
  assert.equal(dependency.status, 201);
  const dependencyId = (await dependency.json()).dependencia.id;
  assert.equal(
    (
      await jsonRequest(roadmapUrl(path, '/dependencias'), 'POST', {
        sourceNodeId: first.id,
        targetNodeId: first.id,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await jsonRequest(roadmapUrl(path, '/dependencias'), 'POST', {
        sourceNodeId: second.id,
        targetNodeId: first.id,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await jsonRequest(roadmapUrl(path, '/dependencias'), 'POST', {
        sourceNodeId: first.id,
        targetNodeId: second.id,
      })
    ).status,
    409,
  );
  assert.equal(
    (await jsonRequest(roadmapUrl(path, `/dependencias/${dependencyId}`), 'DELETE')).status,
    204,
  );
  const recreatedDependency = await jsonRequest(roadmapUrl(path, '/dependencias'), 'POST', {
    sourceNodeId: first.id,
    targetNodeId: second.id,
  });
  assert.equal(recreatedDependency.status, 201);

  assert.equal((await jsonRequest(roadmapUrl(path, `/nodos/${first.id}`), 'DELETE')).status, 204);
  const dto = await (await authFetch(roadmapUrl(path))).json();
  assert.equal(dto.nodos.length, 1);
  assert.equal(dto.dependencias.length, 0);
  assert.equal((await authFetch(roadmapUrl(path, `/nodos/${first.id}/recursos`))).status, 404);
  for (const resourceId of remainingResourceIds) {
    assert.equal(
      (await jsonRequest(roadmapUrl(path, `/recursos/${resourceId}`), 'DELETE')).status,
      404,
    );
  }
  assert.equal((await jsonRequest(roadmapUrl(path, `/tipos/${type.id}`), 'DELETE')).status, 204);
});

serialTest('rejects cross-roadmap mutations for valid UUIDs', async () => {
  assert.equal(
    (
      await jsonRequest(roadmapUrl(otherPath), 'POST', {
        nombreRamo: 'Otro curso',
        departamento: 'DCC',
      })
    ).status,
    201,
  );
  const otherCourse = await prisma.curso.findUniqueOrThrow({
    where: {
      ramoCodigo_anio_semestre: {
        ramoCodigo: otherPath.ramo,
        anio: otherPath.anio,
        semestre: otherPath.semestre,
      },
    },
  });
  const teacher = await prisma.usuario.findFirstOrThrow({
    where: { correoInstitucional: { startsWith: 'docente-' } },
  });
  await prisma.participacion.create({
    data: { usuarioId: teacher.id, cursoId: otherCourse.id, funcion: 'DOCENTE' },
  });
  const foreignNodeResponse = await jsonRequest(roadmapUrl(otherPath, '/nodos'), 'POST', {
    titulo: 'Ajeno',
    typeId: predefinedTypeId,
    posX: 0,
    posY: 0,
  });
  const foreignNode = (await foreignNodeResponse.json()).nodo;
  const foreignResourceResponse = await jsonRequest(
    roadmapUrl(otherPath, `/nodos/${foreignNode.id}/recursos`),
    'POST',
    { titulo: 'Recurso ajeno', url: 'https://example.com/foreign', tipo: 'ENLACE' },
  );
  const foreignResource = (await foreignResourceResponse.json()).recurso;

  const response = await jsonRequest(roadmapUrl(path, `/recursos/${foreignResource.id}`), 'DELETE');
  assert.equal(response.status, 404);
  const resources = await (
    await authFetch(roadmapUrl(otherPath, `/nodos/${foreignNode.id}/recursos`))
  ).json();
  assert.equal(resources.recursos.length, 1);
  assert.equal(
    (await jsonRequest(roadmapUrl(path, `/nodos/${foreignNode.id}`), 'PATCH', { visible: false }))
      .status,
    404,
  );
  const foreignTypeResponse = await jsonRequest(roadmapUrl(otherPath, '/tipos'), 'POST', {
    nombre: 'Ajeno',
    color: '#123456',
  });
  const foreignType = (await foreignTypeResponse.json()).tipo;
  assert.equal(
    (
      await jsonRequest(roadmapUrl(path, `/tipos/${foreignType.id}`), 'PATCH', {
        nombre: 'Ajeno 2',
      })
    ).status,
    404,
  );
  const localDto = await (await authFetch(roadmapUrl(path))).json();
  assert.equal(
    (
      await jsonRequest(roadmapUrl(path, '/dependencias'), 'POST', {
        sourceNodeId: foreignNode.id,
        targetNodeId: localDto.nodos[0].id,
      })
    ).status,
    404,
  );
});

serialTest('student sessions read only visible nodes and cannot mutate', async () => {
  const course = await prisma.curso.findUniqueOrThrow({
    where: {
      ramoCodigo_anio_semestre: { ramoCodigo: path.ramo, anio: path.anio, semestre: path.semestre },
    },
  });
  const student = await prisma.usuario.create({
    data: {
      nombre: 'Estudiante de integración',
      correoInstitucional: `estudiante-${suffix}@uchile.cl`,
      rut: `8${suffix}`,
    },
  });
  await prisma.participacion.create({
    data: { usuarioId: student.id, cursoId: course.id, funcion: 'ESTUDIANTE' },
  });
  studentCookie = await sessionCookie(student.id);
  const hiddenResponse = await jsonRequest(roadmapUrl(path, '/nodos'), 'POST', {
    titulo: 'Nodo oculto',
    typeId: predefinedTypeId,
    posX: 240,
    posY: 0,
    visible: false,
  });
  assert.equal(hiddenResponse.status, 201);
  const hidden = (await hiddenResponse.json()).nodo;
  const studentRoadmap = await fetch(roadmapUrl(path), { headers: { cookie: studentCookie } });
  assert.equal(studentRoadmap.status, 200);
  const studentDto = await studentRoadmap.json();
  assert.equal(
    studentDto.nodos.some((node: { id: string }) => node.id === hidden.id),
    false,
  );
  const forbiddenMutation = await jsonRequest(
    roadmapUrl(path, `/nodos/${hidden.id}`),
    'PATCH',
    { titulo: 'No permitido' },
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
  const sessionCookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { cookie: sessionCookie ?? '' },
  });
  assert.equal(sessionResponse.status, 200);
  assert.equal(
    (await sessionResponse.json()).user.id,
    (
      await prisma.usuario.findUniqueOrThrow({
        where: { correoInstitucional: `vti-${suffix}@uchile.cl` },
      })
    ).id,
  );
  const user = await prisma.usuario.findUnique({
    where: { correoInstitucional: `vti-${suffix}@uchile.cl` },
  });
  assert.equal(user?.rut, '12345678');
  assert.equal(user?.nombre, 'Persona VTI');
  assert.equal(await prisma.participacion.count({ where: { usuarioId: user?.id } }), 0);
});

serialTest('VTI callback uses the secure cookie contract behind HTTPS', async () => {
  const token = await signVtiToken({
    identification: `000012345679-5`,
    email: `https-${suffix}@uchile.cl`,
    name: 'Persona HTTPS',
  });
  const response = await fetch(`${baseUrl}/api/plogin?jwt=${encodeURIComponent(token)}`, {
    redirect: 'manual',
    headers: { 'x-forwarded-proto': 'https' },
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
    const byEmail = await prisma.usuario.create({
      data: {
        nombre: 'Nombre anterior',
        correoInstitucional: `existing-email-${suffix}@uchile.cl`,
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
      (await prisma.usuario.findUniqueOrThrow({ where: { id: byEmail.id } })).nombre,
      'Nombre actualizado',
    );

    const byRut = await prisma.usuario.create({
      data: {
        nombre: 'Vinculación por RUT',
        correoInstitucional: `existing-rut-${suffix}@uchile.cl`,
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
      (await prisma.usuario.findUniqueOrThrow({ where: { id: byRut.id } })).correoInstitucional,
      `existing-rut-${suffix}@uchile.cl`,
    );
    assert.equal(
      await prisma.usuario.count({
        where: { correoInstitucional: `new-email-${suffix}@uchile.cl` },
      }),
      0,
    );

    const emailConflict = await prisma.usuario.create({
      data: {
        nombre: 'Correo en conflicto',
        correoInstitucional: `conflict-email-${suffix}@uchile.cl`,
        rut: `73${suffix}`,
      },
    });
    const rutConflict = await prisma.usuario.create({
      data: {
        nombre: 'RUT en conflicto',
        correoInstitucional: `conflict-rut-${suffix}@uchile.cl`,
        rut: `74${suffix}`,
      },
    });
    const conflictToken = await signVtiToken({
      identification: `74${suffix}-5`,
      email: emailConflict.correoInstitucional,
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
      (await prisma.usuario.findUniqueOrThrow({ where: { id: emailConflict.id } })).nombre,
      'Correo en conflicto',
    );
    assert.equal(
      (await prisma.usuario.findUniqueOrThrow({ where: { id: rutConflict.id } })).nombre,
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
