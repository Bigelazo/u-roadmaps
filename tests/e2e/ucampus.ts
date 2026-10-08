import { createServer } from 'node:http';
import type { MufasaInstitutionalCoursePosition } from '@/integrations/ucampus/server';
import type { E2ECourseOffering, E2EUser } from './fixtures';

const origin = 'http://127.0.0.1:3201';
type Course = {
  codigo: string;
  nombre: string;
  ano: number;
  periodo: number;
  cargo: string | null;
};

/** A real local HTTP boundary, with per-test U-Campus responses keyed by RUT. */
export async function startUcampus() {
  const coursesByRut = new Map<string, Course[]>();
  const failures = new Set<string>();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', origin);
    const rut = url.searchParams.get('rut') ?? '';
    if (request.method === 'PATCH') {
      failures.add(`${rut}:${url.searchParams.get('endpoint')}`);
      response.end();
    } else if (request.method === 'PUT') {
      let body = '';
      for await (const chunk of request) body += chunk;
      const course = JSON.parse(body) as Course;
      const courses = coursesByRut.get(rut) ?? [];
      coursesByRut.set(rut, [
        ...courses.filter(
          (existing) =>
            existing.codigo !== course.codigo ||
            existing.ano !== course.ano ||
            existing.periodo !== course.periodo,
        ),
        course,
      ]);
      response.end();
    } else if (request.method === 'DELETE') {
      coursesByRut.delete(rut);
      failures.delete(`${rut}:cursos_dictados`);
      failures.delete(`${rut}:cursos_inscritos`);
      response.end();
    } else if (!coursesByRut.has(rut) || failures.has(`${rut}:${url.pathname.slice(1)}`)) {
      response.writeHead(503).end();
    } else {
      const courses = coursesByRut.get(rut)!;
      const teaching = url.pathname.endsWith('cursos_dictados');
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(courses.filter((course) => Boolean(course.cargo) === teaching)));
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(3201, '127.0.0.1', resolve);
  });
  return () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
}

export async function reportUcampusPosition(
  user: E2EUser,
  offering: E2ECourseOffering,
  position: MufasaInstitutionalCoursePosition | null,
) {
  // Send the documented institution labels; parsing stays part of the HTTP test.
  const labels = {
    COURSE_PROFESSOR: 'profesor de cátedra',
    COORDINATING_PROFESSOR: 'profesor coordinador',
    AUXILIARY_PROFESSOR: 'profesor auxiliar',
    TEACHING_ASSISTANT: 'ayudante',
    OBSERVER: 'oyente',
  };
  const response = await fetch(`${origin}/?rut=${user.rut}`, {
    method: 'PUT',
    body: JSON.stringify({
      codigo: offering.courseCode,
      nombre: offering.courseName,
      ano: offering.year,
      periodo: offering.semester,
      cargo: position ? labels[position] : null,
    }),
  });
  if (!response.ok) throw new Error(`U-Campus fixture returned ${response.status}`);
}

export async function forgetUcampusUser(user: E2EUser) {
  const response = await fetch(`${origin}/?rut=${user.rut}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`U-Campus fixture returned ${response.status}`);
}

export async function failUcampusEndpoint(
  user: E2EUser,
  endpoint: 'cursos_dictados' | 'cursos_inscritos',
) {
  const response = await fetch(`${origin}/?rut=${user.rut}&endpoint=${endpoint}`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error(`U-Campus fixture returned ${response.status}`);
}
