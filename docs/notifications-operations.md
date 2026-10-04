# Operación de avisos propios

U-Roadmaps consulta y guarda sus avisos en PostgreSQL y transmite invalidaciones
por SSE autenticado. Disponibilidad, Nodos y cambios de acceso, Recursos,
Dependencias y clasificación usan exclusivamente esta entrega y el mismo
agrupador. No hay SDK, configuración de suscriptores, workflows, publicación de
Code Steps ni conexiones a Novu. No se importan avisos del proveedor anterior.
El contrato acordado vive en [#152](https://github.com/Bigelazo/u-roadmaps/issues/152);
[#139](https://github.com/Bigelazo/u-roadmaps/issues/139) y el historial Git conservan
la documentación de la integración retirada como antecedente.

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
`next start`. El agrupador comparte sus ventanas entre las rutas del proceso,
pero no entre réplicas; no usar varios workers, escalado horizontal ni procesos
que suspendan la ejecución entre solicitudes. El repositorio no contiene archivos
de despliegue Docker. PostgreSQL LISTEN permite distribuir señales entre procesos,
pero eso por sí solo no coordina la agrupación.

Aplicar las migraciones antes de arrancar. No limpiar ni recrear las tablas de
avisos: las migraciones conservan los avisos anteriores. No hay caducidad ni tarea
de eliminación por antigüedad. El reset de datos de desarrollo y el de E2E son
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

Las ventanas cierran a los 60 segundos aunque no haya más cambios ni Inbox
abierto. El primer aviso permanece inmutable; el resumen es otra fila con su
propia identidad y cantidad de repeticiones. Se comprueba la Participación activa
antes de publicar un resumen. Cerrar el proceso pierde repeticiones aún no
publicadas, pero conserva los avisos ya guardados. No hay outbox, replay ni
recuperación durable de avisos que no llegaron a persistirse.

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
`own-notification-summaries` comprueban entrega real, ventana de producción,
actualización del Roadmap, contadores, reconocimiento indivisible, propagación
entre pestañas y recuperación. No omiten pruebas por falta de credenciales Cloud.
Los escenarios de audiencia, destinos inaccesibles, acceso revocado y paginación
complementan estos recorridos. Las señales inyectadas en tests unitarios no se
presentan como evidencia de transporte.

## Observabilidad

- `Roadmap notice saved`: un aviso quedó guardado; incluye clase y si es resumen.
- `* notice delivery failed` / `Roadmap availability delivery failed` /
  `Roadmap change summary delivery failed`: fallo de notificación posterior al
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
