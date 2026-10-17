---
status: accepted
date: 2026-10-16
---

# Toda escritura en un Roadmap pasa por un único módulo de comandos

Cada operación que escribía en un Roadmap existente cableaba a mano su permiso, su
comprobación de **Roadmap closure**, su transacción, su diferencia de acceso y su reporte
al `RoadmapChangePort` ([ADR-0024](0024-notice-target-lifecycle-module.md)). Las copias
divergieron: dos contratos de cierre, cinco tipos de transacción sin regla, validación
después del lock y una diferencia de acceso que, si una operación nueva la olvidaba,
dejaba sin Avisos a los participantes afectados. Se decide que toda escritura de un
participante en un Roadmap existente sea un comando de `application/roadmap-command/`.

## Decisiones

- **Un comando declara solo lo suyo:** la capacidad que exige (`complete` o `edit`), un
  `parse` puro, el alcance de acceso de su cambio (`roadmap`, `actor` o `none`, que puede
  depender de la entrada) y su mutación, que devuelve `{ result, facts }`. El comando
  nunca llama al port. Opcionalmente declara su `lock`: `update` (FOR UPDATE, por
  defecto) o `key-share` (FOR KEY SHARE) para el progreso de participantes.
- **Cuatro capacidades:** `read` (cualquier Participation activa), `oversee` (la vista
  docente de un Roadmap, como la Canvas preview o el Student progress tracking: solo el
  equipo docente activo), `complete` (estudiantes activos) y `edit` (equipo docente
  activo). Un Roadmap cerrado solo rechaza `complete` y `edit`.
- **El módulo fija el orden:** parsea antes de la transacción; resuelve la Participation y
  decide capacidad y cierre con la decisión pura de `domain/roadmap-capability.ts`, sin
  lock; bloquea la fila del Roadmap (FOR UPDATE, o FOR KEY SHARE para el progreso de
  participantes: Completion y Canvas preview); relee el cierre bajo el lock; toma las
  instantáneas de acceso que su alcance exige; reporta una sola vez los hechos de contenido
  y de acceso; y entrega solo después del commit.
- **Un Roadmap cerrado se rechaza siempre con `ROADMAP_CLOSED` (409)**
  ([ADR-0018](0018-roadmap-closure-is-a-recorded-event.md)).
- **Una sola regla de aislamiento:** todo cambio del módulo es SERIALIZABLE, prefiere
  índices y reintenta los fallos de serialización con espera creciente; tras el último
  intento responde 409 `CONFLICT`. Las lecturas y las previsualizaciones usan REPEATABLE
  READ sin lock. La creación del Roadmap y la materialización de la Participation siguen
  en READ COMMITTED con su propia orquestación, sobre la misma primitiva de cambio.
- **El alcance de acceso es obligatorio y sin valor por defecto.** Calcularlo siempre
  carga dos veces a cada participante activo y sus Completions en cada edición; olvidarlo
  pierde Avisos en silencio. El tipo exige decidirlo.
- **El Scheduled unlock release usa la capa inferior** (`changeRoadmap`) con su actor de
  sistema: mismo lock, misma diferencia y mismo reporte que un desbloqueo manual, sin
  decisión de capacidad. Un cierre concurrente equivale a "nada liberado".
- **Una entrega fallida no falla el cambio confirmado:** se registra con el Roadmap, el
  actor, las clases de hecho y la causa. No hay reintento durable.
- **Las lecturas usan la misma resolución y decisión (`roadmapRead`), sin port:** solo
  consultan la Participation almacenada y nunca sincronizan con U-Campus. La sincronización
  ocurre al ingresar a la plataforma y al entrar a la página del curso o a Student progress
  tracking; quien no tiene una Participation activa recibe 403. Un Roadmap cerrado sigue
  siendo legible. Una lectura puede declarar `{ roadmap: 'optional' }` para servir una
  Course offering cuyo Roadmap aún no existe (Student progress tracking); entonces solo
  decide la Participation.
- **Las lecturas y las previsualizaciones también parsean antes de autorizar:** un
  identificador inválido responde 400, no 403. Una subida valida su archivo, parsea y
  autoriza antes de guardar los bytes, que se guardan fuera de la transacción porque
  esta puede reintentarse; el registro vuelve a decidir dentro de ella.

## Alternativas descartadas

- **Aislamiento declarado por comando:** son los cinco tipos sin regla de antes, ahora
  explícitos.
- **READ COMMITTED con lock de fila:** reabre las carreras entre Roadmaps y entregas
  concurrentes que protegen los tests de integración (#220).
- **La creación dentro del módulo:** no hay Roadmap que bloquear y copiar archivos no es
  seguro de reintentar.
- **Una costura de transacción simulable:** tendría un solo adapter; las propiedades
  reales (aislamiento, locks, reintentos) solo valen contra PostgreSQL, donde se prueban.
