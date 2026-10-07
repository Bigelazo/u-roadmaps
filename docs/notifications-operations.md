# Operación de avisos propios

> Implementación incremental de [ADR-0014](adr/0014-target-based-notice-grouping.md):
> #177, #179 y #180 activan los Objetos de título, descripción, tipo y acceso de Nodo; #178 activa el reconocimiento al entrar. Este documento describe el estado
> vigente; #181 agrega el Recurso como Objeto y #182 los pares de Dependencias y los nombres de Tipos de nodo.

U-Roadmaps consulta y guarda sus avisos en PostgreSQL y transmite invalidaciones
por SSE autenticado. Disponibilidad, Nodos y cambios de acceso, Recursos,
Dependencias y clasificación usan exclusivamente esta entrega y el mismo
almacenamiento diferido tras la respuesta HTTP. No hay SDK, configuración de suscriptores, workflows, publicación de
Code Steps ni conexiones a Novu. No se importan avisos del proveedor anterior.
El contrato acordado vive en [#152](https://github.com/Bigelazo/u-roadmaps/issues/152);
[#139](https://github.com/Bigelazo/u-roadmaps/issues/139) y el historial Git conservan
la documentación de la integración retirada como antecedente.

## Agrupación del Inbox

#183 agrega una proyección de lectura (`groupBy=roadmapId` en el listado HTTP,
solicitada por el Inbox; el listado sin ese parámetro conserva los avisos individuales): tres o más Objetos pendientes del mismo
Roadmap aparecen en una fila «El Roadmap de CC1002 ha recibido cambios», con
«N cambios». Los contadores siguen contando los Objetos persistidos, no las
filas. Un retiro que deja dos Objetos restaura las filas individuales.
«Roadmap disponible» queda fuera de la agrupación. La fecha y la identidad de
paginación de la fila agrupada pertenecen a su Objeto más reciente; agrupar
antes de paginar evita dividir un Roadmap entre páginas. El clic conserva la
navegación al Roadmap y su reconocimiento habitual.

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

`NodeLifecycleKnowledge` captura en la transacción de creación quién todavía
no conoce el Nodo y conserva ese dato tras ocultarlo o eliminarlo. La relación
pertenece al Roadmap y al Usuario; no depende de que el Nodo siga existiendo.
La entrega y el reconocimiento usan el mismo lock por destinatario y Roadmap.
La apertura captura los valores de los Objetos absorbidos en
`NoticeAcknowledgement.absorptionSnapshots`; reconocerlos fija esos valores
como conocidos y reconcilia los cambios posteriores. Reintentar la misma
apertura no reconoce cambios nuevos. Entrar también fija el conocimiento de
Nodos cuya entrega de creación aún no llegó al Inbox; una Dependencia creada
entre apertura y reconocimiento conserva un Aviso posterior. Los estados de
acceso capturados se validan antes de reconocerlos. Las migraciones agregan conocimiento y
snapshots sin borrar Avisos existentes.

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
reconocimientos y sus recibos de deduplicación, según ADR-0014. Es un reset único;
no hay caducidad ni tarea de eliminación por antigüedad para `RoadmapNotice`.

El título usa `NodeTitleKnowledge` para conservar el último valor conocido por
Usuario y Nodo. Un trigger captura el valor anterior en la transacción de edición;
la entrega diferida consulta el título actual y reconcilia mediante una función
pura. Una clave única parcial impide dos Avisos pendientes del mismo Objeto.
Reconocimiento y entrega usan un lock transaccional por Usuario y Roadmap. Las
actualizaciones y retiros emiten la misma invalidación SSE del Inbox. Los recibos
persisten tras actualizar o retirar un Aviso, por lo que un reintento no lo recrea.

Título y tipo llegan también a quienes ven el Nodo bloqueado; descripción solo
a quienes pueden acceder al Nodo. Los Objetos son independientes.
`NodeContentKnowledge` conserva el texto exacto de la descripción (sin recortar
espacios) y la identidad del Tipo, con nombres capturados en la transacción de
asignación. La transacción de edición captura la descripción anterior solo para
participantes con acceso al Nodo; el trigger de tipo incluye también a quienes
lo ven bloqueado. Repetir ediciones deja un Aviso pendiente por Objeto; volver al
valor conocido lo retira. Renombrar un Tipo no reescribe los nombres del Aviso
de asignación pendiente.

El acceso usa el Objeto `node-access` por Usuario y Nodo, con estados Disponible,
Bloqueado y Retirado. La transacción docente captura la proyección anterior y
actual en `NodeContentKnowledge` (`target = access`), incluyendo Completaciones
por estudiante. La entrega consulta esa proyección actual, por lo que un efecto
diferido no restaura un estado intermedio. Bloqueos y desbloqueos de Nodo o rama,
Desbloqueos programados, cambios de Dependencias y visibilidad reconcilian cada
Nodo cuyo estado cambió para ese destinatario. Un Aviso muestra el estado conocido
y el actual, absorbe pasos intermedios y se retira al volver al conocido. También
se reconoce y aparece en el Resumen de cambios cuando el estado actual es Retirado.
La Completación actualiza la proyección de acceso de ese estudiante y avanza
el valor conocido de los Nodos recién disponibles solo si no tienen un Objeto
de acceso pendiente. Si hay uno, conserva su valor conocido, actualiza el estado
actual y lo retira solo al volver al conocido; no reconoce otros Avisos. El Desbloqueo programado conserva
la atribución a Equipo docente. La migración de
#180 agrega la proyección actual sin borrar Avisos existentes.

Cada Recurso usa un Objeto `resource:<id>` y `ResourceNoticeKnowledge` conserva
su título y revisión conocidos por destinatario, incluso tras quitar el Recurso.
La transacción de creación, edición o eliminación captura el valor anterior solo
para participantes con acceso al Nodo, excluyendo al autor. La entrega consulta
la versión actual: agregado → editado sigue siendo nuevo, agregado → eliminado
retira el Aviso y editado → eliminado conserva el título conocido. Las ediciones
solo detallan cambios de título; URLs, tipos y archivos no se muestran. Apertura
y reconocimiento conservan snapshots de Recursos y rebasan los cambios posteriores
sin reconocerlos en reintentos. La migración de #181 agrega las tablas y snapshots
sin borrar Avisos existentes.

Las Dependencias usan el Objeto `dependency:<origen>:<destino>`, independiente del
id de la arista. `RouteNoticeKnowledge` conserva si el destinatario conocía ese
par, o el nombre conocido de cada Tipo de nodo (`node-type:<id>:name`). La
transacción docente captura el valor anterior antes de la entrega diferida, que
consulta el estado actual. Quitar y volver a agregar un par, o renombrar un Tipo
hasta volver al nombre conocido, retira el Aviso. Invertir una Dependencia crea
dos Objetos distintos. Solo reciben Avisos los participantes activos distintos
del autor: para Dependencias ambos Nodos deben ser visibles; para nombres de
Tipos debe existir al menos un Nodo visible, incluso bloqueado. Ícono y color
no generan Avisos. Ocultar o eliminar un Nodo no genera Avisos de ruta por sus
Dependencias eliminadas en cascada. Apertura y reconocimiento conservan snapshots
de ambos Objetos y rebasan ediciones posteriores sin reconocerlas. La migración
de #182 agrega conocimientos y snapshots sin borrar Avisos existentes.

Las demás
clases mantienen su entrega inmediata; todas se reconocen al entrar al Roadmap. Los siguientes
tickets implementarán las restantes reglas de ADR-0014.

Las aperturas de reconocimiento (`NoticeAcknowledgement`) conservan su conjunto
fijo de `noticeIds` para reintentos durante al menos 24 horas desde `openedAt`.
Al crear una apertura de Roadmap, la misma transacción elimina solo
las aperturas del mismo destinatario anteriores a 24 horas; conserva las del
límite exacto, las recientes y las de otros Usuarios. El índice
`(recipientId, openedAt)` acota esta limpieza por Usuario. No hay proceso
periódico: las aperturas antiguas de un Usuario inactivo permanecen hasta que
cree otra apertura. Esta poda no borra ni modifica Avisos.

Reintentar una apertura ya podada devuelve 404. El cliente conserva el estado
de error de reconocimiento y no sustituye la apertura por otra ni reconoce
Avisos llegados después. Dentro de la retención, el reintento reutiliza el mismo
`operationId` y el mismo conjunto, sin ampliar `noticeIds`. Para títulos también
conserva `titleSnapshots`; descripción, tipo y acceso conservan `contentSnapshots`,
con los valores y nombres capturados al abrir. Si el Aviso cambió
en el intervalo, el reconocimiento avanza al valor capturado y reconcilia el
valor posterior como pendiente; `recognizedAt` impide repetir ese avance en un
reintento. Nunca se reconoce por accidente una actualización posterior del mismo
Aviso.

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
su estado visible y cualquier respuesta tardía. Si falla la preparación inicial,
el reintento conserva el mismo ID de operación y puede preparar el conjunto;
si ya se confirmó su preparación, conserva el conjunto sin reemplazarlo.

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

Antes de responder a una mutación confirmada se capturan los descriptores,
los destinatarios elegibles (sin la autora ni Participaciones inactivas), títulos
y contexto. Solo la persistencia por destinatario se difiere mediante `after()`
de `next/server`, después de enviar la respuesta, en el mismo proceso Node.
Un cambio posterior de acceso o contenido no recalcula esa audiencia ni contexto.
Los fallos diferidos se registran sin datos sensibles ni rechazos no manejados;
no cambian la respuesta ni revierten la edición. La llegada al Inbox es asíncrona:
los clientes y las pruebas esperan la señal SSE o consultan hasta recibir el Aviso.
La liberación periódica de Desbloqueos programados ocurre fuera de una petición
HTTP: ese trabajo usa entrega directa y espera su persistencia antes de terminar
la pasada, sin intentar registrar `after()` fuera de su contexto.

Cada efecto aceptado se guarda sin una ventana de espera, incluidas las repeticiones,
con una identidad independiente y sin resumen separado. `NoticeDeliveryEffect`
y el aviso se guardan en una transacción; repetir una identidad no crea otra
fila. Cerrar el proceso conserva los avisos confirmados. No hay outbox, replay
ni recuperación durable de avisos que no llegaron a persistirse. Un reinicio
puede perder el trabajo diferido todavía no guardado, coherente con #152 y #173. El modelo
acordado en ADR-0014 todavía no está implementado.

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
ordinaria arranca un servidor de producción y usa Chromium y Firefox. Los
recorridos `own-sse-notifications`, `own-notification-operation` y
`own-notification-summaries` comprueban entrega inmediata real, llegada posterior a una apertura,
actualización del Roadmap, contadores, reconocimiento indivisible, propagación
entre pestañas y recuperación. No omiten pruebas por falta de credenciales Cloud.
Los escenarios de audiencia, destinos inaccesibles, acceso revocado y paginación
complementan estos recorridos. Las señales inyectadas en tests unitarios no se
presentan como evidencia de transporte.

## Observabilidad

- `Roadmap notice saved`: un aviso quedó guardado; incluye la clase.
- `* notice delivery failed` / `Roadmap availability delivery failed`: fallo de
  notificación posterior al
  cambio. La edición docente permanece confirmada.
- `Roadmap live signal connection/subscription/payload/projection failed`: fallo
  de señal SSE. Los avisos guardados siguen consultables y la reconexión vuelve
  a leer el estado vigente, sin reconocer automáticamente avisos.

Estos registros no incluyen credenciales, RUT, correos, URLs de Recursos ni
contenido pedagógico. Los IDs de evento, Nodo o Roadmap permiten correlacionar
fallos sin registrar sus títulos. El stream se renueva cada cinco minutos y se
cierra al desconectar la última pestaña; un fallo de LISTEN cierra las conexiones
para que el navegador reconecte. Un error de consulta conserva la última
proyección y ofrece reintento, sin convertir el error en una bandeja vacía.
