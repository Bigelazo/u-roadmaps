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
  id_ramo?: number;
};
type RosterRow = Record<string, unknown> & { rut: number };
type Person = { rut: number; nombre1: string; apellido1: string; apellido2: string };

/** A real local HTTP boundary, with per-test U-Campus responses keyed by RUT. */
export async function startUcampus() {
  const coursesByRut = new Map<string, Course[]>();
  const failures = new Set<string>();
  const rostersByRamo = new Map<string, RosterRow[]>();
  const people = new Map<string, Person>();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', origin);
    const rut = url.searchParams.get('rut') ?? '';
    if (url.pathname === '/integrantes' || url.pathname === '/personas') {
      const isRoster = url.pathname === '/integrantes';
      const ramo = url.searchParams.get('id_ramo') ?? '';
      if (request.method === 'PUT') {
        let body = '';
        for await (const chunk of request) body += chunk;
        if (isRoster) rostersByRamo.set(ramo, JSON.parse(body) as RosterRow[]);
        else
          for (const person of JSON.parse(body) as Person[]) people.set(String(person.rut), person);
        response.end();
      } else if (request.method === 'DELETE') {
        if (isRoster) rostersByRamo.delete(ramo);
        else for (const person of rut.split(',')) people.delete(person);
        response.end();
      } else if (isRoster && !rostersByRamo.has(ramo)) {
        response.writeHead(503).end();
      } else {
        response.setHeader('Content-Type', 'application/json');
        response.end(
          JSON.stringify(
            isRoster
              ? rostersByRamo.get(ramo)
              : rut.split(',').flatMap((person) => people.get(person) ?? []),
          ),
        );
      }
    } else if (request.method === 'PATCH') {
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
  ramoId?: number,
) {
  // Send the documented institution labels; parsing stays part of the HTTP test.
  const labels = {
    STUDENT: null,
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
      ...(ramoId === undefined ? {} : { id_ramo: ramoId }),
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

export type UcampusRosterMember = {
  rut: string;
  section: string;
  position: MufasaInstitutionalCoursePosition;
  /** The U-Campus person name; omitted people have no `personas` entry. */
  name?: { first: string; lastName: string; secondLastName: string };
  /** Defaults to the offering's own Academic term. */
  term?: { year: number; semester: number };
};

// Recorded MUFASA shape: students carry a numeric 0 and staff positions a string id.
const rosterPositions: Record<MufasaInstitutionalCoursePosition, [number | string, string]> = {
  STUDENT: [0, 'Alumno'],
  COURSE_PROFESSOR: ['1', 'Profesor de Cátedra'],
  AUXILIARY_PROFESSOR: ['2', 'Profesor Auxiliar'],
  TEACHING_ASSISTANT: ['3', 'Ayudante'],
  COORDINATING_PROFESSOR: ['6', 'Profesor Coordinador'],
  OBSERVER: ['10', 'Oyente'],
};

/** Registers the `integrantes` of a Course (Ramo) and the `personas` names of its members. */
export async function reportUcampusRoster(
  ramoId: number,
  offering: E2ECourseOffering,
  members: readonly UcampusRosterMember[],
) {
  const rows = members.map(({ rut, section, position, term = offering }) => {
    const [id_cargo, cargo] = rosterPositions[position];
    return {
      id_ramo: ramoId,
      codigo: offering.courseCode,
      seccion: section,
      ano: term.year,
      periodo: term.semester,
      id_periodo: `${term.year}.${term.semester}`,
      rut: Number(rut),
      id_cargo,
      cargo,
    };
  });
  const people = members.flatMap(({ rut, name }) =>
    name
      ? [
          {
            rut: Number(rut),
            nombre1: name.first,
            apellido1: name.lastName,
            apellido2: name.secondLastName,
          },
        ]
      : [],
  );
  for (const [path, body] of [
    [`/integrantes?id_ramo=${ramoId}`, rows],
    ['/personas', people],
  ] as const) {
    const response = await fetch(`${origin}${path}`, { method: 'PUT', body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`U-Campus fixture returned ${response.status}`);
  }
}

export async function forgetUcampusRoster(ramoId: number, ruts: readonly string[]) {
  for (const path of [`/integrantes?id_ramo=${ramoId}`, `/personas?rut=${ruts.join(',')}`]) {
    const response = await fetch(`${origin}${path}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`U-Campus fixture returned ${response.status}`);
  }
}
