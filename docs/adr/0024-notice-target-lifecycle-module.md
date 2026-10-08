---
status: accepted
date: 2026-10-08
---

# Un único módulo es dueño del ciclo de vida de los Notice targets

Cada tipo de Notice target tenía su propia pila (interpretar el efecto, reconciliar, escribir el aviso, capturar al entrar, reconocer y una tabla de Known values), y el feature roadmap escribía directamente esas tablas desde seis lugares para fijar líneas base dentro de sus transacciones. Las reglas de [ADR-0014](0014-target-based-notice-grouping.md) existían cinco veces y ya divergían. Se decide que un único módulo de notifications sea dueño de la escritura completa del ciclo de vida: registrar el Known value al editar, reconciliar al entregar, y capturar y reconocer al entrar al Roadmap. Las reglas de ADR-0014 no cambian; cambian su ubicación y su almacenamiento.

## Decisiones

- **Port del roadmap.** El roadmap define un port por el que registra, dentro de su transacción, los Roadmap changes: hechos por objeto con su valor previo y, para el acceso, las transiciones por destinatario. App conecta una vez el adapter de notifications; los tests usan un adapter que graba. El roadmap deja de escribir tablas de avisos.
- **Audiencia en el módulo.** La decisión 10 de ADR-0014 se aplica solo dentro del módulo.
- **Otros eventos.** La Completion cruza el port como transición de acceso cuyo destinatario es el propio actor, y la promoción a equipo docente como cambio de rol. La pérdida de Participation sigue siendo un trigger de Postgres, como parte de la implementación del módulo.
- **Regla del actor.** El cambio propio avanza el Known value del actor; si el actor tenía un aviso pendiente de ese objeto, el aviso lo absorbe y se retira si vuelve a lo conocido. Corrige que un docente no se enterara cuando otro revertía su cambio.
- **Un solo almacén.** Los Known values viven en una tabla por destinatario, Roadmap y clave de objeto, y las aperturas guardan una sola colección de snapshots.
- **Empezar de cero.** Como en la decisión 12 de ADR-0014, al migrar se borran avisos, aperturas y Known values.
- **Texto al leer.** El aviso guarda datos (objeto, valor conocido, valor actual y contexto); su texto se proyecta al leer.

## Alternativas descartadas

- **Abrir el lint para que roadmap importe notifications:** crea un ciclo entre features, porque notifications ya depende del acceso de roadmap.
- **Outbox durable de Roadmap changes:** más desacoplado y haría durable la entrega, pero exige una tabla nueva, una pasada consumidora y garantías de orden; el port permite agregarlo después como otro adapter.
- **Que el módulo envuelva la escritura y deduzca los cambios:** absorbe el cálculo de acceso por Nodo y cuesta más por edición.
- **Conservar cinco tablas detrás del seam:** cada objeto nuevo seguiría costando una tabla y una migración.
