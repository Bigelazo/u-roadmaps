---
status: accepted
date: 2026-10-07
---

# Verificación visual del versionamiento de Roadmaps

El versionamiento depende del paso del tiempo: un Roadmap solo se cierra después de su Roadmap freeze date. Por eso no puede verificarse esperando al calendario real. Se decide verificarlo de dos formas complementarias:

- un **linaje sembrado en el catálogo de desarrollo**, para la revisión visual manual;
- **E2E con datos propios por test** ([ADR-0013](0013-enable-parallel-e2e-tests.md)), para la verificación automática.

En ambos casos el tiempo se simula con fechas en el pasado y nunca con un reloj falso del servidor.

## Catálogo de desarrollo (revisión manual)

El catálogo representa un linaje completo de FI1001:

| Edición | Estado | Contenido |
|---|---|---|
| 2025-2 | Cerrada | Creada desde cero |
| 2026-1 | Cerrada | Copiada de 2025-2 |
| 2026-2 | Vigente, sin Roadmap | — |

- Las ediciones cerradas se siembran **ya cerradas**: el hecho de cierre está registrado y no quedan Teacher blocks.
  - Además, incluyen filas de `AcademicTerm` con fechas pasadas, para que el proceso de cierre no tenga nada que hacer.
  - Esto es necesario porque el catálogo es de solo lectura para la suite E2E y un cierre ejecutado al arrancar el servidor no debe modificarlo.
- Las versiones incluyen los casos que la copia debe tratar:
  - un Nodo oculto;
  - Dependencias;
  - un Custom node type;
  - Resources de enlace;
  - al menos un Resource de archivo con bytes reales en el volumen de desarrollo.
- Usuarios con un propósito explícito:
  - **Profesor de cátedra de 2026-2**: ve el diálogo de creación con las opciones vacía y "desde una versión anterior", previsualiza 2025-2 y 2026-1 y copia una.
  - **Profesor auxiliar o ayudante de 2026-2**: ve el historial pero no puede crear ni copiar.
  - **Docente que solo participó en 2025-2**: ve 2025-2 pero no 2026-1, porque esta queda fuera de su horizonte.
  - **Profesor coordinador de 2026-2**: no puede crear el Roadmap.
  - **Estudiante de 2026-1**: ve su Roadmap cerrado en el Academic history, sin bloqueos y sin acceso al historial de versiones.
- El script de restablecimiento de datos de desarrollo devuelve el catálogo a su estado inicial después de cada copia manual.

Para revisarlo manualmente se recorren esos usuarios. Después de copiar, se comprueba:

- todos los Nodos visibles aparecen bloqueados;
- el Nodo oculto sigue oculto;
- el Custom node type existe;
- el archivo se descarga desde la nueva edición;
- el visor muestra la autoría y el origen ("Copiada de la edición 2026-1").

## E2E (verificación automática)

- Cada test crea sus propios Cursos del mismo Ramo con `createCourse({ sameCourseAs })`, en **Períodos académicos sintéticos únicos para ese test**.
  - `AcademicTerm` es global por año y semestre, y los tests corren en paralelo.
  - Si dos tests modificaran la fecha de un mismo período, se interferirían.
- Para simular el paso del tiempo, se mueve la Roadmap freeze date al pasado mediante el helper SQL compartido, como ya hace `scheduled-node-unlock.spec.ts` con los Scheduled unlocks.
  - Luego se espera la siguiente pasada del proceso de cierre, configurado con un intervalo corto en E2E.
  - Para el respaldo se usa un período sin fila de `AcademicTerm`.
- Las afirmaciones se hacen sobre lo observable por HTTP y en el navegador:
  - un Roadmap cerrado rechaza ediciones en el servidor;
  - el diálogo de creación ofrece solo versiones cerradas;
  - el horizonte del historial;
  - el estado de la copia;
  - la independencia de los archivos duplicados;
  - la ausencia de datos de estudiantes en el visor.
- `development-fixture.spec.ts` verifica que el catálogo siembra el linaje cerrado esperado, sin modificarlo.
