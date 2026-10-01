# Operación y validación del MVP (#149)

Estado: **no habilitado en producción**. La validación determinista y el ensayo
Novu Cloud son evidencias distintas. La aceptación HTTP de un trigger no prueba
entrega en Inbox, ejecución de Digest ni recepción por WebSocket.

## Manifiesto del despliegue

Completar esta tabla con valores observados en el Dashboard y enlaces a evidencia
antes de aprobar producción. «Pendiente» bloquea la promoción; no es un valor por
defecto del proveedor. No registrar claves, correos, RUT, nombres ni payloads en
este manifiesto o en archivos de evidencia públicos.

| Campo | Estado observado en este checkout |
| --- | --- |
| Environment de prueba / application identifier | Pendiente; sin credenciales Novu configuradas |
| Environment de producción / application identifier | Pendiente |
| Región, API servidor, API Inbox, socket | Pendiente de confirmación; `.env.example` ilustra endpoints US, no decide región |
| Workflows publicados y revisiones | Pendiente; inventario contractual en [workflows.json](workflows.json) |
| Contrato Digest e In-App | [digest.md](digest.md); cinco workflows, 60 segundos, primer aviso inmediato, repeticiones en otro resumen |
| SDK servidor / Inbox / Framework | `@novu/api` 3.19.1 / `@novu/nextjs` 3.19.2 / `@novu/framework` 2.14.0, fijados |
| Next / React / React DOM | 16.3.2 / 19.2.8 / 19.2.8, fijados |
| Plan, cuotas de triggers/suscriptores/requests, límites de tasa | Pendiente de lectura del plan del environment real; no comprar ni inferir un plan |
| Retención efectiva de avisos y actividad/errores | Pendiente de lectura del plan real |
| Responsable de habilitación y revisión de actividad/errores | Pendiente de asignación por el equipo |
| Evidencia Cloud satisfactoria, fecha y responsable | Pendiente; requerida antes de `NOVU_PRODUCTION_APPROVED=true` |

Los cinco IDs por defecto son `roadmap-available`, `roadmap-node-changed`,
`roadmap-resource-changed`, `roadmap-path-changed` y
`roadmap-classification-changed`. Cada variable `NOVU_WORKFLOW_*` debe coincidir
con el workflow publicado en **el mismo environment** de la clave y application
identifier. Activar HMAC en ese environment. Los tres endpoints configurados
(`NOVU_SERVER_URL`, `NEXT_PUBLIC_NOVU_API_URL`, `NEXT_PUBLIC_NOVU_SOCKET_URL`)
deben pertenecer a su región confirmada.

## Matriz de recorridos

Ejecutar cada fila con docente autor y otro docente, estudiante y observador como
receptores cuando corresponda, en dos Cursos y dos sesiones del mismo Usuario.
Excluir al autor y Participaciones inactivas. Un Cargo institucional de observador
usa las capacidades de estudiante; no crea una vía de acceso docente.

| Corte | Cambio y acceso | Filtro / reconocimiento | Evidencia determinista existente | Ensayo real |
| --- | --- | --- | --- | --- |
| #140 | Crear Roadmap; Participaciones activas | Curso/Roadmap; entrada al Roadmap lee aviso general | `emit-roadmap-availability`, `roadmaps.spec` | Pendiente |
| #141 | Nodo creado/editado; visible y accesible, por rol/prerrequisitos | Nodo; abrir detalle lee sus avisos; otros Nodos siguen pendientes | `node-change-notifications`, `deliver-node-change` | Pendiente |
| #142 | Recurso agregado/editado/eliminado; Nodo accesible | Nodo propietario; título conservado tras eliminar | `resources-notifications`, `deliver-resource-change` | Pendiente |
| #143 | Ocultar/eliminar Nodo; receptores con contexto anterior | Roadmap; entrada reconoce cambio; no abre detalle inexistente | `teacher-block-notifications`, `roadmap-node-notifications` | Pendiente |
| #144 | Bloquear/desbloquear rama; comparar acceso antes/después | Roadmap si inaccesible, Nodo si disponible; autor excluido | `teacher-block-notifications`, `node-change-notifications` | Pendiente |
| #145 | Agregar/eliminar Dependencia; efecto por acceso previo/posterior | Roadmap; no reconocer Nodos accesibles sin abrirlos | `dependency-change-notifications`, `dependency-notifications` | Pendiente |
| #146 | Renombrar/reclasificar Tipo de nodo | Roadmap; mensaje conserva tipo anterior/nuevo | `node-type-classification-notifications`, `deliver-roadmap-classification-change` | Pendiente |
| #147 | Repetir cambios por autor/Nodo/Curso/clase | Primer aviso + resumen separado; resumen cuenta como un aviso | `digest-projection`, `novu-digest-grouping`, `resource-node-acknowledgement` | Pendiente |
| #148 | Cambio remoto con panel/preview/confirmación abiertos | Refetch HTTP autorizado; llegada no reconoce; recuperación sin leer | `realtime`, `roadmap-realtime-prototype.spec` | Pendiente |

Los nombres de prueba abreviados se encuentran bajo `tests/`; estas referencias
indican cobertura relacionada, no declaran que el ensayo Cloud esté aprobado.

## Ensayo de contrato Cloud (explícito)

Usar cuentas de prueba sin datos institucionales reales. Guardar evidence por caso
con environment, región, versión/build, UTC de trigger/aceptación/entrega, event ID,
transaction ID, workflow run ID, notification IDs anonimizados, resultado esperado,
resultado observado y responsable. Los timestamps efectivos `occurredAt` se
comparan con los de entrega `createdAt`; no son intercambiables.

1. Identidad: HMAC válido permite el Inbox; hash manipulado, hash de otro
   suscriptor y application identifier de otro environment se rechazan. Un Usuario
   no lista/lee avisos de otro. Logout y cambio de Usuario desmontan el proveedor,
   limpian filtro/selección y eliminan callbacks del Usuario previo.
2. Fan-out: realizar cada fila de la matriz; revisar receptores explícitos contra
   acceso/rol, excluyendo autor/inactivos y separando Cursos. Repetir el **mismo**
   transaction ID y confirmar ausencia de duplicado; repetir otro evento y
   confirmar entrega distinta. Registrar actividad Novu, no solo HTTP 2xx.
3. Digest: ejecutar los ocho casos de [digest.md](digest.md), medir la ventana real
   de 60 segundos y comprobar el contenido escalar publicado de las cinco clases.
4. Seen/read: abrir Inbox con filas fuera de viewport: solo visibles pasan a seen,
   ninguna pasa a read. Abrir un Nodo: leer sus avisos previos; los de otro Nodo
   y los llegados después del snapshot siguen pendientes. Repetir con más de 100
   avisos y llegada durante paginación. Fallar read/list y reintentar: no anunciar
   éxito antes de respuesta, conservar IDs y límite temporal originales.
5. Realtime: dos pestañas; callback/socket produce refetch autorizado solo del
   Curso activo, actualiza conteos entre pestañas y no lee por llegada. Cortar y
   restaurar conexión; comprobar recuperación de feed, conteos y Roadmap. Revocar
   acceso durante el ensayo y comprobar salida al Resumen académico.
6. Ejecutar explícitamente `RUN_NOVU_REALTIME=1 pnpm run test:e2e --
   tests/e2e/roadmap-novu-websocket.spec.ts` con el environment de prueba configurado
   y PostgreSQL existente. Este test cubre un callback real; no reemplaza los
   casos anteriores. Nunca ejecutar dos suites E2E simultáneas.

CI habitual mantiene transporte determinista y omite el ensayo Cloud.

## Accesibilidad y comprensión

Estado de evaluación con personas y lector de pantalla: **pendiente**.
Registrar navegador, dispositivo, resolución, tecnología asistiva y hallazgos.
En desktop y móvil verificar campana, lista desplazable, cierre, carga, vacío,
error y reintento; navegar por Tab/Shift+Tab/Enter/Escape y confirmar foco visible,
retorno de foco y nombres/conteos anunciados. Con reducción de movimiento activa,
la navegación debe conservarse. Cambiar zona horaria del navegador y comprobar
fecha absoluta local en español de `occurredAt`, incluyendo cambio de día y dato
inválido (sin fecha inventada).

Mostrar un primer aviso y su resumen a participantes; pedirles identificar Curso,
Nodo, último cambio, autor y número de cambios, explicar si el primer aviso fue
reemplazado y qué acción elimina el pendiente. Registrar respuestas y correcciones,
sin presentar un walkthrough del equipo como evaluación de comprensión realizada.

## Fallos y observabilidad

Todos los emisores comparten envío best-effort: provisionamiento en lotes de 500,
triggers en lotes de 100, dos intentos como máximo por lote, timeout de 3 segundos
por request y `Retry-After` de hasta 3 segundos antes del segundo intento. Revalidan
Participación activa antes de cada trigger y reutilizan transaction ID por lote.
No reintentan credenciales/payload inválidos (error no recuperable). No esperan un
`Retry-After` mayor que el presupuesto. Los límites son por lote, no una garantía
de duración constante de un fan-out grande. Un timeout local no cancela el request
remoto: la clave idempotente reduce duplicados.

Los logs de provisionamiento y trigger incluyen solo `eventId`, `workflowId`,
`roadmapId`, `operation`, `attempt`, `durationMs`, `recipientCount`, `result`.
`accepted` significa aceptación del request; `failed` no prueba ausencia de entrega.
No imprimir error crudo del SDK, clave, HMAC, destinatarios, nombre, RUT, URL de
Recurso ni contenido. El responsable revisa actividad/errores Novu y compara con
logs; la ausencia de un log no prueba éxito. Fallos antes de invocar el emisor
(consulta de destinatarios o caída de proceso) pueden no tener log de trigger.

Inyectar timeout, 429 con Retry-After y 401/403 en transporte determinista tras el
commit: verificar respuesta de mutación y una lectura HTTP posterior del contenido
guardado. El ensayo de credenciales inválidas usa únicamente environment de prueba.

## Promoción y reversión

1. Mantener `NOVU_NOTIFICATIONS_ENABLED=false` y
   `NOVU_PRODUCTION_APPROVED=false` en producción. Configurar test environment,
   región/HMAC, workflows y Code Steps; ejecutar matriz y ensayo Cloud.
2. Completar manifiesto (incluidos cuotas, retención y responsable) y resolver todos
   los fallos. El responsable firma evidencia satisfactoria. Sin ella, detener la
   promoción y mantener producción deshabilitada.
3. Promover workflows/Code Steps por Dashboard al environment de producción y
   configurar clave/application identifier/endpoints de **ese** environment.
   Las variables `NEXT_PUBLIC_*` quedan fijadas al build: reconstruir al cambiarlas.
4. Ejecutar comprobaciones y comprobar bundle con un sentinel sin valor productivo:
   `NOVU_SECRET_KEY=novu-bundle-sentinel-149 pnpm run build`, después
   `NOVU_SECRET_KEY=novu-bundle-sentinel-149 pnpm run check:notification-bundle`.
   El scanner falla si falta el build o encuentra clave/nombre de variable secreta
   en JS/source maps estáticos. Para E2E usar `NEXT_DIST_DIR=.next-e2e` en el scanner.
5. Con evidencia aprobada, establecer ambos interruptores en `true`, reiniciar
   servidores y recargar sesiones; comprobar actividad/errores y smoke por rol.
6. Reversión: `NOVU_NOTIFICATIONS_ENABLED=false`, reiniciar servidores y recargar
   sesiones. Esto retira identidad/superficies y detiene nuevos envíos. No necesita
   migración, no bloquea Roadmaps ni elimina avisos ya guardados en Novu.
   Pestañas ya montadas necesitan recarga; no se promete apagado instantáneo remoto.

La retención es finita y puede hacer desaparecer avisos pendientes. Digest conserva
solo detalle acotado del último cambio y conteo, no historial completo. Existe una
ventana de pérdida entre commit y Novu y durante fallos; no se garantiza entrega
durable. No hay tabla de avisos ni outbox local.

## Resultado de esta ejecución

Comprobaciones locales del 2026-10-01:

- Typecheck: aprobado.
- Unitarias: 60 archivos, 295 pruebas aprobadas. Ejecutadas con `.env.development`
  y `NEXTAUTH_URL` retirado del proceso de pruebas para conservar los orígenes de
  los casos de prueba. La primera ejecución sin environment falló por falta de
  `DATABASE_URL`; una ejecución con environment completo expuso ese override de URL
  y un timeout por carga concurrente. La ejecución final aislada pasó.
- ESLint: cero errores; ocho advertencias preexistentes en E2E.
- Prettier: los archivos cambiados pasan; el chequeo global señala 11 archivos
  preexistentes fuera de este cambio.
- Build de producción y bundle: 22 artefactos JS/source maps revisados sin Secret
  Key; el scanner también rechaza un sentinel filtrado intencionalmente.
- E2E: 84 aprobadas y 2 omitidas (ensayo WebSocket real, uno por navegador),
  Firefox/Chrome, un worker, PostgreSQL existente. Una primera ejecución sandboxed tuvo
  abortos de launch de navegador; la siguiente superó el presupuesto de arranque
  de 30 segundos. Se amplió a 120 segundos y se repitió una única suite secuencial.
- Graphify: `graphify update .` ejecutado tras los cambios de código; 2408 nodos y
  4739 relaciones. Doce archivos SQL no se extrajeron por ausencia de
  `tree_sitter_sql`; la actualización fue AST, sin extracción semántica de docs.
- Code-review: una sola pasada con ejes Standards/Spec. Sin violaciones de código
  documentadas ni defectos concretos adicionales; Spec señaló evidencia real,
  manifiesto observado y evaluación humana faltantes.

Ensayo Cloud, HMAC inválido contra proveedor, cuotas/retención reales y evaluación
humana pendientes por falta de environment/cuentas configurados. El issue #149
sigue sin cumplir todos sus criterios y este documento no autoriza producción.
