# Operación de avisos propios

> Modelo de [ADR-0014](adr/0014-target-based-notice-grouping.md) (agrupación por
> Objeto del aviso, reconocimiento al entrar) implementado por el módulo de ciclo
> de vida de [ADR-0024](adr/0024-notice-target-lifecycle-module.md). No hay
> ventanas de tiempo ni estado «visto».

U-Roadmaps guarda sus avisos en PostgreSQL y transmite invalidaciones por SSE
autenticado. No hay SDK, credenciales ni servicios externos de notificaciones.

## Comportamiento

- **Objeto del aviso.** Cada Aviso compara un Objeto (título, descripción, tipo o
  acceso de un Nodo, un Recurso, un par de Dependencia, el nombre de un Tipo de
  nodo, creación o eliminación de Nodo, disponibilidad del Roadmap) con el último
  valor que el destinatario conocía. Los cambios posteriores actualizan el mismo
  Aviso; volver al valor conocido lo retira. El autor de un cambio nunca recibe
  Aviso por él.
- **Absorción.** Un Nodo nuevo absorbe sus propios cambios; ocultarlo o eliminarlo
  antes del reconocimiento retira su creación. Eliminar un Nodo conocido
  sustituye sus Avisos por el de eliminación. «Roadmap disponible» pendiente
  absorbe los demás Avisos de ese Roadmap.
- **Visibilidad.** Solo se muestran y cuentan Objetos visibles para el
  destinatario; para estudiantes, descripción y Recursos de Nodos bloqueados quedan
  ocultos, pero pendientes. Al equipo docente, la visibilidad y el Bloqueo docente de un
  Nodo nunca le ocultan sus avisos ([ADR-0014](adr/0014-target-based-notice-grouping.md),
  decisión 10, «Equipo docente»). Perder la Participación retira sus Avisos pendientes
  y sus aperturas de forma definitiva.
- **Inbox.** Las filas se titulan con el nombre del ramo. Con tres o más Objetos
  pendientes del mismo Roadmap (salvo disponibilidad), el Inbox los presenta en
  una fila agrupada; los contadores suman Objetos, no filas. Se agrupa antes de
  paginar. El clic solo navega al Roadmap.
- **Reconocimiento.** Abrir la campana o un Nodo no cambia estado. Entrar al
  Roadmap (el canvas montado, no prefetch) captura y reconoce todos sus Avisos
  pendientes. Salvo en la primera entrada, si hubo cambios visibles se muestra
  una vez el Resumen de cambios; Entendido solo cierra el dialog. Una
  actualización llegada después de la captura queda pendiente.
- **Marca por Nodo.** El canvas marca los Nodos con Objetos cambiados desde que el
  destinatario los abrió por última vez (`NodeChangeReview`).
- **Tiempo real.** Inbox y contadores se actualizan en vivo para todos los roles.
  Solo las sesiones docentes recargan el contenido del Roadmap abierto;
  estudiantes y observadores lo leen al volver a entrar. Una pérdida de acceso
  (`accessLost`) hace que toda sesión verifique su acceso por HTTP.
- **Destino no disponible.** Un enlace con `?notice=` a un Curso o Roadmap que ya
  no está disponible redirige al Resumen académico con una razón explícita, sin
  mostrar el Aviso.

## Instalar y arrancar

Usar el PostgreSQL existente y configurar `.env.production` con `DATABASE_URL`,
`NEXTAUTH_URL`, `NEXTAUTH_SECRET` y las variables de autenticación institucional
que describe el README.

```sh
pnpm install --frozen-lockfile
pnpm prisma:generate
NODE_ENV=production pnpm exec dotenv -e .env.production -- pnpm prisma:migrate
NODE_ENV=production pnpm exec dotenv -e .env.production -- pnpm prisma:seed
pnpm build
pnpm start
```

Aplicar las migraciones antes de arrancar la nueva versión. La operación admitida
es **un único proceso Node persistente** (`next start`); no se certifica escalado
horizontal y el repositorio no incluye despliegue Docker. El reset de datos de
desarrollo y el de E2E son herramientas de pruebas, nunca pasos de producción.

## Entrega diferida

Dentro de la transacción de la edición se registran los Known values y se decide
la audiencia. La persistencia por destinatario se difiere con `after()` de
`next/server`, después de responder, en el mismo proceso. Los fallos diferidos se
registran y no cambian la respuesta ni revierten la edición. La liberación
periódica de Desbloqueos programados ocurre fuera de una petición y espera su
entrega antes de terminar la pasada.

`NoticeDeliveryEffect` deduplica cada efecto, así que repetirlo no crea otro
Aviso. No hay outbox ni replay: un reinicio puede perder la entrega diferida aún
no guardada, pero conserva los Avisos confirmados y sus valores conocidos.

## SSE y proxy

`GET /api/notifications/stream` usa PostgreSQL LISTEN sobre el mismo
`DATABASE_URL`. Cada proceso con pestañas conectadas mantiene una conexión
dedicada adicional al pool de Prisma, liberada al desconectar la última pestaña.
Usar una conexión directa o pooling de sesión: el pooling por transacción no
conserva LISTEN.

El stream envía un heartbeat cada 15 segundos y se cierra a los cinco minutos
para reautenticar. El proxy debe mantener `text/event-stream`, desactivar
buffering y caché para esa ruta, respetar `X-Accel-Buffering: no` y tolerar más
de 15 segundos de inactividad. Con nginx:

```nginx
location /api/notifications/stream {
    proxy_pass http://127.0.0.1:3000;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 60s;
}
```

Las señales solo llevan identificadores; los datos se recargan por HTTP
autenticado. Tras conectar, reconectar o recuperar la red, el cliente vuelve a
leer el estado guardado, por lo que las señales perdidas se reparan solas.

## Retención y reparación

No hay caducidad de `RoadmapNotice` ni tareas periódicas de limpieza. Las
aperturas de reconocimiento (`NoticeAcknowledgement`) se conservan al menos 24
horas para reintentos; crear una apertura poda las del mismo Usuario anteriores
a ese límite. Reintentar una apertura podada devuelve 404.

Borrar una fila de `NoticeKnownValue` es seguro: el siguiente cambio del Objeto
vuelve a fijar el valor anterior, por lo que se pierde a lo sumo ese Aviso, nunca
se inventa uno. Para corregir un Aviso pendiente incorrecto, borrarlo y fijar su
Known value al valor actual.

## Observabilidad

- `Roadmap notice delivery failed`: falló la entrega posterior al cambio (solo
  incluye el id del Roadmap). La edición permanece confirmada.
- `Roadmap live signal connection/subscription/payload/projection failed`: falló
  la señal SSE. Los avisos guardados siguen consultables y la reconexión relee el
  estado vigente.

Los registros no incluyen credenciales, RUT, correos, URLs de Recursos ni
contenido pedagógico.

## Verificar

```sh
pnpm build
```

La cobertura E2E de avisos vive en `tests/e2e/own-*.spec.ts` y
`roadmap-entry-summary.spec.ts`; cómo ejecutarla está en la
[guía de pruebas](agents/testing.md).
