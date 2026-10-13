---
status: accepted
date: 2026-10-13
---

# El seguimiento de estudiantes lee la nómina de U-Campus en cada consulta

[ADR-0021](0021-student-progress-tracking-needs-external-discovery.md) dejó
**Student progress tracking** pendiente de definición. El responsable del proyecto
fijó su alcance al pedir la página de integrantes; el contraste con usuarios
docentes que proponía ese ADR no se realizó. Se decide implementar la vista como
una lectura en vivo de la nómina de U-Campus, sin materializarla, y medir el
progreso con el **Roadmap completion rate** y la **Average student completion**
definidos en el glosario.

## Fuente de la nómina

- MUFASA `integrantes` filtrado por `id_ramo` devuelve todas las Secciones. El
  `id_ramo` se obtiene de los cursos de la persona docente (`cursos_dictados` y
  `cursos_inscritos` lo informan); no se almacena.
- Con `id_ramo`, MUFASA **ignora `id_periodo`** y devuelve todos los períodos del
  Ramo, por lo que el Período académico se filtra localmente. Verificado contra el
  servicio real el 2026-10-13.
- `integrantes` solo trae RUT. Los nombres se piden a `personas` en lotes de RUTs
  separados por comas y no se guardan; solo se usan nombre y apellidos. Si faltan,
  se usa el nombre de U-Roadmaps y, en último caso, el RUT.

## Alternativa descartada: materializar la nómina

Importar la nómina como Participations (la **Roster synchronization** pendiente)
crearía Usuarios que nunca ingresaron y obligaría a decidir cuándo y quién
sincroniza. La lectura en vivo muestra a todos los inscritos sin crear datos, a
cambio de varias peticiones a U-Campus por consulta y de no conservar un
historial de la nómina.

## Consecuencias

- Si U-Campus no responde, la vista muestra solo las Participations activas
  locales y avisa que el listado está incompleto; nunca presenta ese respaldo
  como la nómina completa.
- Las Completions de quien U-Campus reporta como equipo docente no cuentan como
  progreso; los oyentes se listan con su porcentaje, fuera del promedio.
- Solo el equipo docente activo del Curso la consulta, sobre todas sus Secciones,
  como ya establece el dominio. Estudiantes y externos reciben la misma respuesta
  que un Curso inexistente.
- Quedan fuera por ahora la hora del último **Platform entry** (solo se indica si
  la persona ingresó alguna vez), la consulta por Sección y la exportación.
