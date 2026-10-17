---
status: accepted
date: 2026-10-16
---

# Las reglas de edición del Roadmap son decisiones de dominio compartidas por ambos adapters

La **Sesión del canvas del roadmap** tiene dos adapters de persistencia: el servidor
(`application/editor.ts`, sobre Prisma) y el **Mapa de práctica** en memoria
([ADR-0025](0025-tutorials-run-on-an-in-memory-practice-roadmap.md)). Cada uno escribía
su propia copia de las reglas de crear una Dependencia, ocultar un Nodo y programar un
Desbloqueo programado; las copias coincidían solo gracias a invariantes implícitas, y
las del servidor solo se probaban contra Postgres. Se decide que cada regla sea una
decisión pura en `domain/`, con el mismo patrón que `decideTeacherBlock`: recibe la
parte del grafo que necesita y devuelve `ALLOWED` con lo derivado o `REJECTED` con
motivo y mensaje; el cambio de visibilidad nunca se rechaza y devuelve solo sus efectos.
Ambos adapters la llaman y solo aplican el resultado.

## Decisiones

- **Una decisión por concepto.** `decideDependency` (`domain/dependency.ts`),
  `decideVisibilityChange` (`domain/node-visibility.ts`), `decideScheduledUnlock`
  (`domain/scheduled-unlock.ts`) y `decideNodeTypeChange` (`domain/node-type.ts`), junto
  a `decideTeacherBlock`. La Completación reutiliza `studentNodeAccessById`.
- **El mensaje vive en el dominio; el código HTTP, en el servidor.** El tutorial y el
  servidor muestran el mismo texto.
- **Los hechos de cambio no son parte de la decisión.** Los de acceso siguen saliendo de
  comparar instantáneas antes y después de la escritura
  ([ADR-0024](0024-notice-target-lifecycle-module.md)).
- **Un adapter nuevo, o un comando nuevo con regla, llama a una decisión**; no reescribe
  la regla.
- **La memoria no libera Desbloqueos programados vencidos:** la decisión exige un día
  posterior a hoy y un Mapa de práctica vive una sola sesión.

## Alternativas descartadas

- **Planificadores que devuelven mutaciones y hechos:** obligan a un intérprete de
  mutaciones en Prisma y duplican los hechos de acceso, que ya se derivan por diferencia.
- **Suite de contrato contra ambos adapters:** exige Postgres para el servidor; como ambos
  llaman las mismas decisiones, la interfaz que vale la pena probar es la decisión.
- **Partir `editor.ts` por agregado:** mueve código sin concentrarlo.

## Nota — 2026-10-17: las reglas de los Tipos de nodo

Crear, editar y eliminar un Tipo de nodo pasan por `decideNodeTypeChange`
(`domain/node-type.ts`). Un Tipo de nodo predefinido es inmutable, el nombre normalizado
es único entre los Tipos de nodo predefinidos y los del Roadmap, y no se elimina un Tipo
de nodo que algún Nodo usa. El Mapa de práctica no aplicaba ninguna de las tres reglas:
dejaba Nodos sin Tipo de nodo y aceptaba nombres que el servidor rechaza. Ahora ambos
adapters llaman la decisión y muestran sus mensajes; los códigos HTTP siguen en el
servidor (#263).
