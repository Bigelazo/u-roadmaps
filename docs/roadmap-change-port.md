# Port de Roadmap changes

El port público `RoadmapChangePort`, exportado por `features/roadmap/server`, recibe
hechos por objeto con sus valores previo y actual. El Roadmap calcula las
transiciones de acceso por destinatario, incluyendo al actor. Completion reporta
las transiciones del propio estudiante y la sincronización académica reporta
la promoción de estudiante a equipo docente.

Las escrituras reciben el port como dependencia explícita; las lecturas no lo
reciben, porque no sincronizan la Participation con U-Campus (solo lo hace la
entrada a una página). El módulo de comandos del Roadmap (`application/roadmap-command/`,
[ADR-0029](adr/0029-roadmap-writes-run-through-one-command-module.md)) une los hechos
de contenido de cada comando con los de acceso y llama una sola vez
`report(transaction, changes)` dentro de la transacción de la mutación; un cambio sin
hechos no reporta. El trabajo que devuelve el adapter se ejecuta únicamente después de
un commit exitoso. Cada intento de una transacción serializable tiene su propia
colección de trabajo; un rollback la descarta. Un fallo en el trabajo posterior al
commit conserva el resultado de la mutación y se registra con el Roadmap, el actor, las
clases de hecho y la causa.

La composición está en `app/_adapters/roadmap-changes.ts`. El adapter solo llama
`recordRoadmapNotices` del módulo de ciclo de vida de avisos
(`features/notifications/server`): el módulo registra los Known values y decide la
audiencia dentro de la transacción, y devuelve la entrega, que el adapter difiere
con `after()`. El port del Scheduled unlock pass usa la misma composición con
entrega inmediata después del commit. No existe registro global, traducción por
clase de hecho ni estado mutable compartido entre peticiones. Los handlers
reciben resultados sin campos destinados a notificaciones.

El port es el único camino de los cambios del Roadmap hacia los avisos. El feature
roadmap no lee ni escribe tablas de avisos ni toma locks de destinatario:
Completion y la promoción llegan como hechos y el módulo aplica la regla del
actor de ADR-0024. Roadmap closure continúa sin reportar cambios.

Los tests de operaciones están en
`tests/features/roadmap/change-port-operations.test.ts`. Usan el adapter que graba
en `tests/features/roadmap/support/recording-change-port.ts`, datos propios y
PostgreSQL local, sin mocks de Prisma para avisos. Corren en la suite unitaria con
la preparación existente de `roadmap_notifications_test_db`; requieren
`NOTIFICATIONS_DATABASE_URL` en `.env`, igual que la suite de integración.
Los tests del módulo de comandos (`tests/features/roadmap/roadmap-command.test.ts`),
con el mismo adapter y PostgreSQL, comprueban la entrega después del commit, el
descarte ante un commit fallido, que solo entrega el intento confirmado, que una
entrada inválida responde 400 antes de la autorización y del lock, y que las
lecturas y las previsualizaciones del editor no bloquean el Roadmap. El comportamiento de los avisos se verifica contra PostgreSQL en la
suite de integración del módulo (`tests/notifications-integration/`), sin mocks
de Prisma, y en los specs E2E `own-*`.
