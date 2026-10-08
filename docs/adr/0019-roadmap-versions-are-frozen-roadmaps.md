---
status: accepted
date: 2026-10-07
---

# Las versiones del Roadmap son los Roadmaps congelados y se reutilizan por copia

Una versión de un Ramo es **el propio Roadmap cerrado** de uno de sus Cursos, identificado por su Período académico ("Edición 2026-1"). No se toman instantáneas ni se usa una tabla de versiones aparte: el **Roadmap closure** ([ADR-0018](0018-roadmap-closure-is-a-recorded-event.md)) garantiza la inmutabilidad, y los estudiantes de ese semestre ven en su Academic history lo mismo que el equipo docente ve en el historial. Para reutilizar una versión hay que **copiarla** con identidades nuevas. Nunca se comparte la versión entre dos Cursos.

## Ver frente a copiar

- **Roadmap version history:** cualquier miembro del equipo docente puede consultarlo en cualquier momento.
  - Ve las versiones cerradas del Ramo hasta el último Período académico en que tiene una Participation docente **activa** en él. Nunca ve versiones posteriores. Si vuelve a ser docente, su horizonte avanza.
  - Solo ve contenido pedagógico, origen y autoría. No ve Completions, progreso ni Participations de estudiantes, ni siquiera de un Curso en el que participó.
  - Se consulta en un **visor de versiones dedicado** de solo lectura, separado de la página del Curso. Hay tres entradas: el Roadmap vigente, el diálogo de creación y las filas de Cursos pasados del Academic overview.
  - Los estudiantes no tienen acceso al historial.
- **Roadmap copy:** la hace exclusivamente el profesor de cátedra, y solo al crear el Roadmap, como alternativa a crearlo vacío.
  - Solo se pueden elegir versiones cerradas del mismo Ramo.
  - Un Roadmap ya creado no puede importar una versión.

## Semántica de la copia

- Se crean identidades nuevas para el Roadmap, los Nodos, las Dependencias, los Custom node types y los Resources. Se conservan el contenido y las posiciones.
- No se copian Participations, Completions, Simulated completions, avisos ni Scheduled unlocks.
- Todo Nodo visible nace con Teacher block. Los Nodos ocultos siguen ocultos.
- Los archivos subidos se **duplican**: cada copia recibe un `fileKey` nuevo y bytes propios. Así, eliminar o reemplazar material en una edición nunca afecta a otra. Si el archivo de origen falta en disco, ese Resource se omite en silencio y la copia continúa.
- La copia registra la versión de origen, de la que se forma la **Roadmap lineage**. Un Roadmap vacío no tiene predecesor.

## Autoría

- El Roadmap registra a su **Roadmap creator**: el profesor de cátedra que lo creó, vacío o por copia. Esta atribución es permanente.
- La versión muestra:
  - al creador;
  - al equipo docente con Participation activa al momento del cierre, con su Institutional course position ([ADR-0017](0017-persist-institutional-course-position.md));
  - su origen ("Copiada de la edición 2026-1" o "Creada desde cero").
- Si el creador ya no pertenece al equipo docente al cierre, igual se muestra como creador.

## Alternativas consideradas

- **Instantánea separada al cerrar:** duplica datos sin beneficio, porque el Roadmap cerrado ya no cambia.
- **Compartir archivos entre versiones:** exige contar referencias. Un error al hacerlo corrompería una versión que debía ser inmutable.
- **Restringir el historial a los Cursos en que la persona participó:** impediría el caso más valioso, el traspaso de un Ramo a un profesor nuevo.
- **Reutilizar la página del Curso como visor:** mezcla dos accesos distintos, participar en el Curso y consultar el historial del Ramo, y arriesga filtrar datos de estudiantes.
