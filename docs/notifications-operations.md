# Operación de avisos propios

> Modelo implementado de [ADR-0014](adr/0014-target-based-notice-grouping.md):
> agrupación por Objeto del aviso, reconocimiento al entrar y proyección del Inbox
> por Roadmap. No hay ventanas de tiempo ni estado «visto».

U-Roadmaps consulta y guarda sus avisos en PostgreSQL y transmite invalidaciones
por SSE autenticado. Todas las clases de Objeto pasan por el mismo módulo de
ciclo de vida y la misma entrega diferida tras la respuesta HTTP. No hay SDK, configuración de suscriptores, workflows, publicación de
Code Steps ni conexiones a Novu. No se importan avisos del proveedor anterior.
El contrato acordado vive en [#152](https://github.com/Bigelazo/u-roadmaps/issues/152);
[#139](https://github.com/Bigelazo/u-roadmaps/issues/139) y el historial Git conservan
la documentación de la integración retirada como antecedente.

## Agrupación del Inbox

#183 agrega una proyección de lectura (`groupBy=roadmapId` en el listado HTTP,
solicitada por el Inbox; el listado sin ese parámetro conserva los avisos individuales): tres o más Objetos pendientes del mismo
Roadmap aparecen en una fila «El Roadmap de CC1002 ha recibido cambios», con
«N cambios». Los contadores cuentan los Objetos pendientes visibles para el destinatario, no las
filas. Un retiro que deja dos Objetos restaura las filas individuales.
«Roadmap disponible» queda fuera de la agrupación. La fecha y la identidad de
paginación de la fila agrupada pertenecen a su Objeto más reciente; agrupar
antes de paginar evita dividir un Roadmap entre páginas. El clic conserva la
navegación al Roadmap y su reconocimiento habitual.

La consulta aplica visibilidad, agrupación y cursor en PostgreSQL; solo devuelve
la página solicitada y una fila adicional para detectar la página siguiente.
Los contadores agregan los Objetos visibles en la base de datos con la misma
proyección de visibilidad que el listado.

## Visibilidad y pérdida de Participación

#185 aplica la visibilidad antes de agrupar, paginar y contar. Los Avisos de
Descripción y Recursos no se muestran mientras el Nodo esté bloqueado para el
destinatario; ocultar el Nodo oculta también sus Avisos de título y tipo.
Estos Avisos permanecen pendientes y reaparecen con la misma identidad si el
Objeto vuelve a ser visible antes del reconocimiento. Entrar al Roadmap los
reconoce igualmente, sin incluirlos en el Resumen de cambios. Los Avisos de
acceso a Retirado y de eliminación describen cambios del Roadmap y conservan
su presentación aunque el Nodo ya no esté representado.

Desactivar una Participación retira sus Avisos pendientes de ese Curso y
elimina sus aperturas guardadas, de forma indivisible en PostgreSQL. Recuperar
la Participación no los restaura ni permite reintentar una apertura anterior.
`Participation.noticeResetAt` descarta entregas diferidas anteriores a la
pérdida incluso si la Participación ya volvió a estar activa. La entrega, la apertura y el reconocimiento bloquean
la fila de Participación con `FOR SHARE` antes del lock por destinatario y Roadmap hasta terminar; la desactivación espera
esa entrega y retira sus Avisos, o la entrega ve la Participación desactivada.
Los cambios de visibilidad y Completación invalidan también el Inbox por SSE.

## Absorción de creación, eliminación y disponibilidad

#184 activa las absorciones de ADR-0014. Mientras un Nodo sea nuevo para un
destinatario, todas sus ediciones de título, descripción, tipo, acceso y Recursos
actualizan un único Aviso «Nuevo Nodo», con su estado actual. Un Bloqueo se indica
en ese Aviso. Ocultarlo o eliminarlo antes del reconocimiento retira el Aviso;
volver a mostrarlo produce de nuevo un Aviso de Nodo nuevo. Eliminar un Nodo
conocido sustituye todos sus Avisos pendientes por el Aviso de eliminación.
«Roadmap disponible» pendiente absorbe todos los demás Avisos de ese Roadmap.
Cada absorción actualiza la fecha; los contadores cuentan únicamente los Objetos
resultantes.

La creación es un Objeto amplio del módulo (`node:<id>:creation`): quien todavía
no conoce el Nodo tiene el Known value `absent`, registrado en la transacción de
creación, y ese valor absorbe los Objetos del Nodo. La eliminación
(`node:<id>:deletion`) y la disponibilidad (`roadmap:<id>:availability`) son
también Objetos amplios. La entrega y el reconocimiento usan el mismo lock por
destinatario y Roadmap. La apertura captura los Objetos amplios en la colección
única `NoticeAcknowledgement.snapshots`; reconocerlos fija esos valores como
conocidos y reconcilia los cambios posteriores. Reintentar la misma apertura no
reconoce cambios nuevos. Entrar también fija el conocimiento de Nodos cuya
entrega de creación aún no llegó al Inbox; una Dependencia creada entre apertura
y reconocimiento conserva un Aviso posterior. Los estados de acceso capturados se
validan antes de reconocerlos.

## Instalar y arrancar

Usar el PostgreSQL existente y configurar `.env.production` con `DATABASE_URL`,
`NEXTAUTH_URL`, `NEXTAUTH_SECRET` y las variables de autenticación institucional
que describe el README. Los avisos no necesitan credenciales externas.

```sh
pnpm install --frozen-lockfile
pnpm prisma:generate
NODE_ENV=production pnpm exec dotenv -e .env.production -- pnpm prisma:migrate
NODE_ENV=production pnpm exec dotenv -e .env.production -- pnpm prisma:seed
pnpm build
pnpm check:notification-bundle
pnpm start
```

La operación admitida ejecuta **un único proceso Node persistente** mediante
`next start`. Ya no hay ventanas de agrupación en memoria. Esta validación no
certifica escalado horizontal; el repositorio no contiene archivos de despliegue
Docker. PostgreSQL LISTEN distribuye las señales entre procesos.

Aplicar las migraciones antes de arrancar. La migración de #177 activa el primer
Objeto del aviso (título de Nodo) y elimina todos los Avisos existentes, sus
reconocimientos y sus recibos de deduplicación, según ADR-0014. Es la migración a cero del almacenamiento anterior, no una conversión de
Avisos históricos. La limpieza de esas tablas forma parte de esa migración
y de los resets aislados de pruebas; no es una tarea periódica de producción.
Las migraciones posteriores conservan los Avisos del modelo nuevo.
No hay caducidad ni tarea de eliminación por antigüedad para `RoadmapNotice`.

## Módulo de ciclo de vida de avisos

Desde ADR-0024 (#198) un único módulo de notifications
(`src/features/notifications/infrastructure/notice-lifecycle/`) es dueño de todo
el ciclo de vida de los Avisos. El Roadmap no lee ni escribe tablas de avisos:
reporta hechos por el port de cambios del Roadmap
([roadmap-change-port.md](roadmap-change-port.md)) y el módulo hace el resto.

1. **Registrar** (dentro de la transacción de la edición): fija el Known value
   anterior de cada destinatario que todavía no tiene uno, decide la audiencia y
   aplica la regla del actor. Eliminar un Nodo borra en ese momento los Known
   values de sus Objetos y de los pares de Dependencia que lo incluían, salvo la
   creación no reconocida (`absent`) de los destinatarios de la eliminación, que
   su entrega absorbe y borra.
2. **Entregar** (después del commit, una transacción por destinatario): acepta el
   efecto en `NoticeDeliveryEffect`, toma el lock por destinatario y Roadmap y
   reconcilia el Objeto contra su valor actual con una única ruta genérica:
   retirar, conservar, actualizar en el mismo Aviso o crear.
3. **Capturar y reconocer** (al entrar al Roadmap): la apertura guarda los Objetos
   pendientes en `NoticeAcknowledgement.snapshots`; reconocer fija esos valores.

Cada clase de Objeto es un descriptor en
`src/features/notifications/application/notice-targets/` (registro en `index.ts`).

| Objeto | Clave (`targetKey`) | Valores |
| --- | --- | --- |
| Título | `node:<id>:title` | título |
| Descripción | `node:<id>:description` | texto exacto (sin recortar) |
| Tipo del Nodo | `node:<id>:nodeType` | id del Tipo; nombre en `context.typeName` |
| Acceso | `node:<id>:access` | `Disponible`, `Bloqueado`, `Retirado` |
| Recurso | `resource:<id>` | JSON `{title, revision}` o `null` si no existe |
| Par de Dependencia | `dependency:<origen>:<destino>` | `true` / `false` |
| Nombre de Tipo de nodo | `node-type:<id>:name` | nombre |
| Creación de Nodo | `node:<id>:creation` | `absent` / `present` |
| Eliminación de Nodo | `node:<id>:deletion` | sin Known value guardado |
| Disponibilidad | `roadmap:<id>:availability` | `absent` / `present` |

### Almacenamiento

- `NoticeKnownValue` es el único almacén de Known values: una fila por
  `(recipientId, roadmapId, targetKey)`, con `knownValue`, `nodeId` (sin FK; ubica el
  Objeto en el Nodo y permite limpiarlo), `currentValue` (solo acceso: el estado
  por destinatario al momento de la edición, para que una entrega diferida no
  restaure un estado intermedio) y `context` (contexto de presentación del valor
  conocido, p. ej. el nombre del Tipo).
- `NoticeAcknowledgement.snapshots` es la única colección de capturas de una
  apertura: entradas `{id, noticeTarget, targetKey, nodeId, currentValue, …}` de
  todas las clases de Objeto (`id` puede ser `null` para Objetos sin Aviso).
- `RoadmapNotice.data` guarda datos, no texto: `noticeTarget`, `targetKey`,
  `knownValue`, `currentValue`, `context` y los campos que lee la proyección
  (`changeKind`, `nodeId`, `sourceNodeId`/`targetNodeId`, `nodeTypeId`). Asunto y
  cuerpo se proyectan al leer con el `wording` del descriptor; las columnas
  `subject`/`body` son una caché. Cambiar la redacción no requiere migración.
  Una clave única parcial impide dos Avisos pendientes del mismo Objeto.
- Los recibos de `NoticeDeliveryEffect` persisten tras actualizar o retirar un
  Aviso, por lo que un reintento no lo recrea.

Los Known values se pierden con la Participación (trigger
`withdraw_participation_notices`, junto con los Avisos pendientes y las
aperturas) y con la eliminación del Nodo. Una creación no reconocida (`absent`)
se conserva solo para los destinatarios de la eliminación, hasta que su entrega
absorbe la eliminación y la borra.

### Audiencia y regla del actor

Título y tipo llegan a quienes ven el Nodo, aunque esté bloqueado; descripción y
Recursos solo a quienes pueden acceder al Nodo. Los pares de Dependencia exigen
ambos Nodos visibles; los nombres de Tipo, al menos un Nodo visible de ese Tipo.
Ícono y color no generan Avisos; ocultar o eliminar un Nodo no genera Avisos por
las Dependencias eliminadas en cascada. El acceso se calcula por destinatario en
el Roadmap (bloqueos de Nodo o rama, Desbloqueos programados, Dependencias y
visibilidad) y se reconcilia en cada Nodo cuyo estado cambió para él; también se
reconoce y aparece en el Resumen de cambios cuando el estado actual es Retirado.

El autor de un cambio nunca recibe Aviso por él: su propio cambio avanza su Known
value. Si tenía un Aviso pendiente de ese Objeto, el Aviso lo absorbe y se retira
si vuelve a lo conocido; así un docente se entera cuando otro revierte su cambio.
La Completación es el mismo caso para el estudiante, y la promoción a equipo
docente reinicia sus Known values de acceso y retira sus Avisos de acceso
pendientes. El Desbloqueo programado conserva la atribución a Equipo docente.

Comportamientos que se deducen de los valores: volver al valor conocido retira el
Aviso; un Recurso agregado y luego editado sigue siendo nuevo, y agregado y
eliminado no deja Aviso; invertir una Dependencia afecta dos pares; renombrar un
Tipo no reescribe el nombre conocido de un Aviso de asignación pendiente. La
revisión de un Recurso es una huella SHA-256 de título, URL, tipo, identidad del
archivo y tipo MIME; las ediciones solo detallan cambios de título.

### Inspeccionar y reparar

```sql
-- Known values de un destinatario en un Roadmap
SELECT "targetKey", "nodeId", "knownValue", "currentValue", context
FROM "NoticeKnownValue" WHERE "recipientId" = $1 AND "roadmapId" = $2
ORDER BY "targetKey";

-- Avisos pendientes con sus valores
SELECT id, "targetKey", data->>'knownValue' AS known, data->>'currentValue' AS current
FROM "RoadmapNotice"
WHERE "recipientId" = $1 AND "roadmapId" = $2 AND "acknowledgedAt" IS NULL;

-- Known values huérfanos (no debería haber; la eliminación del Nodo los borra)
SELECT * FROM "NoticeKnownValue" k
WHERE k."nodeId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "RoadmapNode" n WHERE n.id = k."nodeId");
```

Borrar una fila de `NoticeKnownValue` es seguro: el siguiente cambio del Objeto
vuelve a fijar el valor anterior como conocido, por lo que se pierde a lo sumo
ese Aviso, nunca se inventa uno. Para reparar un Aviso pendiente incorrecto,
borrarlo y fijar el Known value al valor actual; la próxima entrega reconcilia
desde ahí. La migración `20261009170000_drop_per_kind_notice_storage` eliminó las
tablas y columnas por clase anteriores y los Known values huérfanos.

Todas las clases reconcilian su Objeto del aviso sin ventanas de tiempo y se
reconocen únicamente al entrar al Roadmap.

Las aperturas de reconocimiento (`NoticeAcknowledgement`) conservan su conjunto
fijo de `noticeIds` para reintentos durante al menos 24 horas desde `openedAt`.
Al crear una apertura de Roadmap, la misma transacción elimina solo
las aperturas del mismo destinatario anteriores a 24 horas; conserva las del
límite exacto, las recientes y las de otros Usuarios. El índice
`(recipientId, openedAt)` acota esta limpieza por Usuario. No hay proceso
periódico: las aperturas antiguas de un Usuario inactivo permanecen hasta que
cree otra apertura. Esta poda no borra ni modifica Avisos.

Reintentar una apertura ya podada mediante HTTP devuelve 404; esa petición no
crea otra apertura ni reconoce Avisos llegados después. La interfaz actual no
muestra un banner ni un botón para reintentar el reconocimiento fallido: los
Avisos permanecen pendientes y no se muestra el Resumen de cambios. Una nueva
entrada prepara una operación nueva. El contrato HTTP permite reintentar la
operación original dentro de la retención, reutilizando el mismo
`operationId` y el mismo conjunto, sin ampliar `noticeIds`. Todos los Objetos se
capturan en la colección única `snapshots`, con los valores y el contexto
capturados al abrir. Si el Aviso cambió
en el intervalo, el reconocimiento avanza al valor capturado y reconcilia el
valor posterior como pendiente; `recognizedAt` impide repetir ese avance en un
reintento. Nunca se reconoce por accidente una actualización posterior del mismo
Aviso.

Cada apertura recibe una secuencia persistente. `RoadmapVisit` conserva la mayor
secuencia reconocida, incluso después de podar aperturas: una confirmación tardía
de una apertura anterior no retrocede los valores conocidos. También se captura
el estado de los Objetos al entrar cuando no quedan Avisos pendientes, para que
una apertura posterior sin cambios prevalezca sobre una anterior. Esta captura
no agrega Objetos al Resumen. La captura sintética solo reconcilia Objetos con
Avisos pendientes, para no crear avisos a partir de una edición de la autora.

Entrar al Roadmap reconoce todos sus avisos pendientes, incluidos los de Nodos,
y los retira del Inbox y de los contadores. El servidor captura el conjunto y
el contenido del Resumen de cambios cuando el canvas prepara la entrada por
HTTP al montarse; luego confirma el reconocimiento con la misma operación.
Prefetch y render sin montar no reconocen ni crean una visita.
`RoadmapVisit` conserva la primera entrada por Usuario y Roadmap independientemente
de la poda de aperturas: esa primera entrada nunca muestra un dialog.
En las posteriores, el resumen agrupa por título actual del Nodo y deja Ruta y
clasificación al final (incluidas las reasignaciones de Tipo de nodo), sin
autores, fechas ni navegación. Cerrar con Entendido
no hace consultas ni modifica el reconocimiento. Los avisos sobre contenido
no accesible se reconocen sin exponerlo en el resumen.

Abrir la campana o un Nodo no cambia estado. Se retiraron `seenAt`, la acción
`seen`, el marcado por fila visible y el PATCH de avisos individuales. El clic
solo navega al Roadmap; el antiguo dialog por `?notice=` ya no existe.

El resumen pertenece a la entrada activa: salir del Roadmap o refrescar descarta
su estado visible y cualquier respuesta tardía. En el contrato HTTP, si falla
la preparación inicial, una petición con el mismo ID puede preparar el conjunto;
si ya se confirmó su preparación, conserva el conjunto sin reemplazarlo. Esta
idempotencia no implica que la interfaz ofrezca una acción de reintento.

El reset de datos de desarrollo y el de E2E son
herramientas de pruebas, nunca pasos de operación en producción.

LISTEN requiere una conexión directa a PostgreSQL o pooling de sesión. Cada
proceso con pestañas conectadas consume una conexión dedicada adicional al pool
Prisma. El proxy debe mantener `text/event-stream`, desactivar buffering y caché
para `/api/notifications/stream`, respetar `X-Accel-Buffering: no` y permitir el
heartbeat de 15 segundos. Si se usa nginx:

```nginx
location /api/notifications/stream {
    proxy_pass http://127.0.0.1:3000;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 60s;
}
```

Antes de responder a una mutación confirmada, el módulo registra los Known
values y decide la audiencia (sin la autora) dentro de la transacción de la
edición. Solo la persistencia por destinatario se difiere mediante `after()`
de `next/server`, después de enviar la respuesta, en el mismo proceso Node.
Un cambio posterior de acceso o contenido no recalcula esa audiencia ni contexto.
Los fallos diferidos se registran sin datos sensibles ni rechazos no manejados;
no cambian la respuesta ni revierten la edición. La llegada al Inbox es asíncrona:
los clientes y las pruebas esperan la señal SSE o consultan hasta recibir el Aviso.
La liberación periódica de Desbloqueos programados ocurre fuera de una petición
HTTP: ese trabajo usa entrega directa y espera su persistencia antes de terminar
la pasada, sin intentar registrar `after()` fuera de su contexto.

Cada efecto aceptado se reconcilia de inmediato contra el estado actual y el
último valor conocido del destinatario. `NoticeDeliveryEffect` deduplica la
identidad del efecto en la misma transacción que crea, actualiza o retira el
Aviso pendiente: repetir el efecto no crea otra fila. Varias ediciones del mismo
Objeto actualizan su Aviso; volver al valor conocido lo retira. No se guarda un
resumen separado. Cerrar el proceso conserva los Avisos confirmados y sus valores
conocidos. No hay outbox, replay ni recuperación durable de efectos que no llegaron
a persistirse. Un reinicio puede perder el trabajo diferido todavía no guardado,
coherente con #152 y #173.

## Destinos que dejaron de estar disponibles

La pérdida de Participación retira los Avisos, por lo que el Inbox actualizado
no ofrece enlaces a ese Curso. Una pestaña con una fila cargada antes del retiro,
un enlace antiguo o una navegación en carrera todavía puede llegar con `?notice=`.
Si ya no existe el Curso, no se recupera una Participación activa o falta el
Roadmap, la página redirige al Resumen académico con una razón explícita y muestra
el aviso de destino no disponible. Este fallback no consulta ni reconoce el
Aviso retirado y no muestra su contenido. Un parámetro `notice` aislado en el
Resumen académico no muestra ese mensaje. La revocación durante una sesión usa
su flujo independiente `accessLost=1`, también para estudiantes y observadores.

## Verificar

Con PostgreSQL local y `E2E_DATABASE_URL` apuntando a `roadmap_e2e_db`, ejecutar
una sola invocación E2E a la vez:

```sh
pnpm typecheck
pnpm test:unit
pnpm test:e2e
NEXT_DIST_DIR=.next-e2e pnpm check:notification-bundle
```

La comprobación del bundle inspecciona los artefactos de cliente, servidor,
trazas de dependencias y lockfile sin necesitar un secreto centinela. La suite
ordinaria arranca un servidor de producción y usa los proyectos configurados en
`playwright.config.ts` (actualmente Chromium). Los
recorridos `own-sse-notifications`, `own-notification-operation` y
`own-notice-absorption` y `roadmap-entry-summary` comprueban entrega inmediata real, llegada posterior a una apertura,
actualización docente del Roadmap, contenido estudiantil estable, contadores, reconocimiento indivisible, propagación
entre pestañas y recuperación. No omiten pruebas por falta de credenciales Cloud.
Los escenarios de audiencia, destinos inaccesibles, acceso revocado y paginación
complementan estos recorridos. Las señales inyectadas en tests unitarios no se
presentan como evidencia de transporte.

## Observabilidad

- `Roadmap notice delivery failed`: fallo de la entrega posterior al cambio
  (incluye solo el id del Roadmap). La edición docente permanece confirmada.
- `Roadmap live signal connection/subscription/payload/projection failed`: fallo
  de señal SSE. Los avisos guardados siguen consultables y la reconexión vuelve
  a leer el estado vigente, sin reconocer automáticamente avisos.

Estos registros no incluyen credenciales, RUT, correos, URLs de Recursos ni
contenido pedagógico. Los IDs de evento, Nodo o Roadmap permiten correlacionar
fallos sin registrar sus títulos. El stream se renueva cada cinco minutos y se
cierra al desconectar la última pestaña; un fallo de LISTEN cierra las conexiones
para que el navegador reconecte. Un error de consulta conserva la última
proyección y ofrece reintento, sin convertir el error en una bandeja vacía.
