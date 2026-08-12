import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import test from 'node:test';

const port = 3100 + (process.pid % 500);
const baseUrl = `http://localhost:${port}`;
const suffix = Date.now().toString();
const path = { ramo: `CC${suffix}`, anio: 2026, semestre: 1 };
const otherPath = { ramo: `CI${suffix}`, anio: 2026, semestre: 1 };
const predefinedTypeId = '00000000-0000-4000-8000-000000000001';
let server: ChildProcess;

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

async function jsonRequest(url: string, method: string, body?: Record<string, unknown>) {
  return fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

test.before(async () => {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(port)], {
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://roadmap_test_user:roadmap_test_password@localhost:5433/roadmap_test_db',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: 'ignore',
  });
  await waitForServer();
});

test.after(() => {
  server.kill('SIGTERM');
});

test('GET without a roadmap returns the stable not-found error', async () => {
  const response = await fetch(roadmapUrl(path));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'ROADMAP_NOT_FOUND');
});

test('creates and reads an academic roadmap as a domain DTO', async () => {
  const created = await jsonRequest(roadmapUrl(path), 'POST', { nombreRamo: 'Curso de prueba', departamento: 'DCC' });
  assert.equal(created.status, 201);
  const conflict = await jsonRequest(roadmapUrl(path), 'POST', { nombreRamo: 'Otro nombre', departamento: 'DCC' });
  assert.equal(conflict.status, 409);

  const response = await fetch(roadmapUrl(path));
  assert.equal(response.status, 200);
  const dto = await response.json();
  assert.equal(dto.ramo.codigo, path.ramo);
  assert.deepEqual(dto.nodos, []);
  assert.equal('data' in dto, false);
  assert.equal('edges' in dto, false);
});

test('manages nodes, dependencies, custom types, and resources', async () => {
  const typeResponse = await jsonRequest(roadmapUrl(path, '/tipos'), 'POST', { nombre: ' Laboratorio ', color: '#abcdef' });
  assert.equal(typeResponse.status, 201);
  const type = (await typeResponse.json()).tipo;
  assert.equal((await jsonRequest(roadmapUrl(path, '/tipos'), 'POST', { nombre: 'laboratorio', color: '#ABCDEF' })).status, 409);
  assert.equal((await jsonRequest(roadmapUrl(path, '/tipos'), 'POST', { nombre: ' contenido ', color: '#abcdef' })).status, 409);
  assert.equal((await jsonRequest(roadmapUrl(path, `/tipos/${type.id}`), 'PATCH', { nombre: 'Práctica', color: '#123456' })).status, 200);

  const firstResponse = await jsonRequest(roadmapUrl(path, '/nodos'), 'POST', { titulo: 'Primero', typeId: type.id, posX: 0, posY: 0 });
  const secondResponse = await jsonRequest(roadmapUrl(path, '/nodos'), 'POST', { titulo: 'Segundo', typeId: predefinedTypeId, posX: 120, posY: 0 });
  assert.equal(firstResponse.status, 201);
  assert.equal(secondResponse.status, 201);
  const first = (await firstResponse.json()).nodo;
  const second = (await secondResponse.json()).nodo;
  assert.equal((await jsonRequest(roadmapUrl(path, `/tipos/${predefinedTypeId}`), 'PATCH', { nombre: 'Otro' })).status, 409);
  assert.equal((await jsonRequest(roadmapUrl(path, `/tipos/${type.id}`), 'DELETE')).status, 409);

  const resource = await jsonRequest(roadmapUrl(path, `/nodos/${first.id}/recursos`), 'POST', { titulo: 'Guía', url: 'https://example.com/guide', tipo: 'ENLACE' });
  assert.equal(resource.status, 201);
  const resourceBody = (await resource.json()).recurso;
  assert.equal('nodoId' in resourceBody, false);
  assert.equal((await jsonRequest(roadmapUrl(path, `/recursos/${resourceBody.id}`), 'PATCH', { titulo: 'Guía actualizada', tipo: 'VIDEO' })).status, 200);
  assert.equal((await jsonRequest(roadmapUrl(path, `/recursos/${resourceBody.id}`), 'DELETE')).status, 204);
  const remainingResourceIds: string[] = [];
  for (const tipo of ['ARCHIVO', 'VIDEO']) {
    const remainingResource = await jsonRequest(roadmapUrl(path, `/nodos/${first.id}/recursos`), 'POST', { titulo: tipo, url: 'https://example.com/resource', tipo });
    assert.equal(remainingResource.status, 201);
    remainingResourceIds.push((await remainingResource.json()).recurso.id);
  }
  assert.equal((await jsonRequest(roadmapUrl(path, `/nodos/${first.id}/recursos`), 'POST', { titulo: 'Sin URL', tipo: 'ENLACE' })).status, 400);
  assert.equal((await jsonRequest(roadmapUrl(path, `/nodos/${first.id}/recursos`), 'POST', { titulo: 'Unsafe', url: 'javascript:alert(1)', tipo: 'ENLACE' })).status, 400);
  const updatedNodeResponse = await jsonRequest(roadmapUrl(path, `/nodos/${first.id}`), 'PATCH', { titulo: 'Primero actualizado', descripcion: 'Detalle', typeId: predefinedTypeId, visible: false, posX: 50, posY: 60 });
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
    { titulo: 'Primero actualizado', descripcion: 'Detalle', typeId: predefinedTypeId, visible: false, posX: 50, posY: 60 },
  );

  const dependency = await jsonRequest(roadmapUrl(path, '/dependencias'), 'POST', { sourceNodeId: first.id, targetNodeId: second.id });
  assert.equal(dependency.status, 201);
  const dependencyId = (await dependency.json()).dependencia.id;
  assert.equal((await jsonRequest(roadmapUrl(path, '/dependencias'), 'POST', { sourceNodeId: first.id, targetNodeId: first.id })).status, 409);
  assert.equal((await jsonRequest(roadmapUrl(path, '/dependencias'), 'POST', { sourceNodeId: second.id, targetNodeId: first.id })).status, 409);
  assert.equal((await jsonRequest(roadmapUrl(path, '/dependencias'), 'POST', { sourceNodeId: first.id, targetNodeId: second.id })).status, 409);
  assert.equal((await jsonRequest(roadmapUrl(path, `/dependencias/${dependencyId}`), 'DELETE')).status, 204);
  const recreatedDependency = await jsonRequest(roadmapUrl(path, '/dependencias'), 'POST', { sourceNodeId: first.id, targetNodeId: second.id });
  assert.equal(recreatedDependency.status, 201);

  assert.equal((await jsonRequest(roadmapUrl(path, `/nodos/${first.id}`), 'DELETE')).status, 204);
  const dto = await (await fetch(roadmapUrl(path))).json();
  assert.equal(dto.nodos.length, 1);
  assert.equal(dto.dependencias.length, 0);
  assert.equal((await fetch(roadmapUrl(path, `/nodos/${first.id}/recursos`))).status, 404);
  for (const resourceId of remainingResourceIds) {
    assert.equal((await jsonRequest(roadmapUrl(path, `/recursos/${resourceId}`), 'DELETE')).status, 404);
  }
  assert.equal((await jsonRequest(roadmapUrl(path, `/tipos/${type.id}`), 'DELETE')).status, 204);
});

test('rejects cross-roadmap mutations for valid UUIDs', async () => {
  assert.equal((await jsonRequest(roadmapUrl(otherPath), 'POST', { nombreRamo: 'Otro curso', departamento: 'DCC' })).status, 201);
  const foreignNodeResponse = await jsonRequest(roadmapUrl(otherPath, '/nodos'), 'POST', { titulo: 'Ajeno', typeId: predefinedTypeId, posX: 0, posY: 0 });
  const foreignNode = (await foreignNodeResponse.json()).nodo;
  const foreignResourceResponse = await jsonRequest(roadmapUrl(otherPath, `/nodos/${foreignNode.id}/recursos`), 'POST', { titulo: 'Recurso ajeno', url: 'https://example.com/foreign', tipo: 'ENLACE' });
  const foreignResource = (await foreignResourceResponse.json()).recurso;

  const response = await jsonRequest(roadmapUrl(path, `/recursos/${foreignResource.id}`), 'DELETE');
  assert.equal(response.status, 404);
  const resources = await (await fetch(roadmapUrl(otherPath, `/nodos/${foreignNode.id}/recursos`))).json();
  assert.equal(resources.recursos.length, 1);
  assert.equal((await jsonRequest(roadmapUrl(path, `/nodos/${foreignNode.id}`), 'PATCH', { visible: false })).status, 404);
  const foreignTypeResponse = await jsonRequest(roadmapUrl(otherPath, '/tipos'), 'POST', { nombre: 'Ajeno', color: '#123456' });
  const foreignType = (await foreignTypeResponse.json()).tipo;
  assert.equal((await jsonRequest(roadmapUrl(path, `/tipos/${foreignType.id}`), 'PATCH', { nombre: 'Ajeno 2' })).status, 404);
  const localDto = await (await fetch(roadmapUrl(path))).json();
  assert.equal((await jsonRequest(roadmapUrl(path, '/dependencias'), 'POST', { sourceNodeId: foreignNode.id, targetNodeId: localDto.nodos[0].id })).status, 404);
});
