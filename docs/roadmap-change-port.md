# Port de Roadmap changes

El port público `RoadmapChangePort`, exportado por `features/roadmap/server`, recibe
hechos por objeto con sus valores previo y actual. El Roadmap calcula las
transiciones de acceso por destinatario, incluyendo al actor. Completion reporta
las transiciones del propio estudiante y la sincronización académica reporta
la promoción de estudiante a equipo docente.

Las operaciones reciben el port como dependencia explícita.
`roadmapChangeTransaction` llama `report(transaction, changes)` dentro de la
transacción de la mutación. El trabajo que devuelve el adapter se ejecuta
únicamente después de un commit exitoso. Cada intento de una transacción
serializable tiene su propia colección de trabajo; un rollback la descarta.
Un fallo en el trabajo posterior al commit conserva el resultado de la mutación.

La composición está en `app/_adapters/roadmap-changes.ts`. El adapter transitorio
traduce los hechos a los entry points de entrega existentes, prepara el contexto
tras el commit y difiere la persistencia con `after()`. El port del Scheduled
unlock pass usa la misma traducción con persistencia inmediata después del
commit. No existe registro global ni estado mutable compartido entre peticiones.
Los handlers reciben resultados sin campos destinados a notificaciones.

Este prefactor conserva las escrituras de líneas base en el feature roadmap.
Completion y la promoción siguen reconciliando allí y su traducción de entrega
es silenciosa. Los siguientes tickets de #198 moverán esas escrituras al módulo
de notifications y aplicarán la regla del actor de ADR-0024. Roadmap closure
continúa sin reportar cambios.

Los tests de operaciones están en
`tests/features/roadmap/change-port-operations.test.ts`. Usan el adapter que graba
en `tests/features/roadmap/support/recording-change-port.ts`, datos propios y
PostgreSQL local, sin mocks de Prisma para avisos. Corren en la suite unitaria con
la preparación existente de `roadmap_notifications_test_db`; requieren
`NOTIFICATIONS_DATABASE_URL` en `.env`, igual que la suite de integración.
Los tests del adapter comprueban entrega diferida, entrega inmediata y aislamiento
de fallos; los de la transacción comprueban el orden de commit y el descarte en
rollback. Los specs E2E `own-*` se mantienen sin cambios como oráculo de aceptación.
