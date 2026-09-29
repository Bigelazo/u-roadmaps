# Contrato operativo de Novu para el MVP de notificaciones

**Fecha de revisión:** 2026-09-17  
**Alcance:** Novu Cloud, Inbox web para Next.js y triggers server-side. Solo se usaron documentación, APIs, paquetes publicados y código fuente oficiales, además del código local de U-Roadmaps.

## Respuesta ejecutiva

Novu cubre nativamente la infraestructura que el MVP necesita: Inbox con campana, feed y estados persistidos; autenticación del suscriptor con HMAC; fan-out mediante Topics; Digest configurable; filtros y conteos por `data`; timestamps; y actualizaciones del Inbox por WebSocket. El proyecto puede usar su UUID local de usuario como `subscriber`, `@novu/nextjs` en el cliente y `@novu/api` exclusivamente en servidor.

Hay cuatro límites que condicionan el diseño:

1. **Digest no es automático.** Es un paso que se agrega y configura en un workflow. Sin ese paso, cada trigger produce su propia ejecución.
2. **El arreglo de eventos digeridos no llega automáticamente al Inbox.** Está disponible para pasos posteriores del workflow, pero el cliente recibe el `subject`, `body` y `data` que el paso in-app haya proyectado. `data` admite como máximo 10 propiedades escalares y strings de 256 caracteres.
3. **El realtime de Novu actualiza notificaciones y conteos, no el Roadmap.** U-Roadmaps debe usar la notificación recibida como señal para recargar su proyección si quiere reflejar el cambio docente en una pestaña abierta.
4. **Novu no reemplaza la autorización ni la membresía de dominio.** Un Topic entrega a sus suscriptores actuales; U-Roadmaps sigue siendo responsable de mantener ese Topic sincronizado con las participaciones activas y de no emitir datos que el estudiante no deba conocer.

La integración es compatible en papel con el stack actual: U-Roadmaps usa pnpm 11.22, Next.js 16.3, React 19.2, App Router y NextAuth con un UUID estable en `session.user.id`. Al revisar el registro npm, `@novu/nextjs` 3.19.2 declara peers para Next `^16.0.0`, React `^19.0.0` y React DOM `^19.0.0`, depende de `@novu/react` 3.19.2 y publica una variante App Router basada en `next/navigation`. Fuentes: [`package.json` local](../../package.json), [sesión local](../../src/shared/server/session/index.ts), [metadatos publicados de `@novu/nextjs` 3.19.2](https://registry.npmjs.org/@novu/nextjs/3.19.2), [setup oficial del Inbox](https://docs.novu.co/platform/inbox/setup-inbox).

## 1. Identidad y autenticación segura del Inbox

### Documentado por Novu

- `applicationIdentifier` es público; la Secret Key concede acceso administrativo y nunca debe llegar al navegador.
- Pasar solo un identificador de suscriptor permite que alguien intente suplantar otro `subscriber`. Para producción, Novu indica habilitar HMAC en el proveedor In-App, calcular en servidor `HMAC-SHA256(NOVU_SECRET_KEY, subscriberId)` y entregar el resultado al cliente como `subscriberHash`.
- Con HMAC habilitado, el Inbox no carga si faltan el suscriptor o su hash.
- La prop actual preferida es `subscriber`; `subscriberId` sigue tipada pero está deprecada en los paquetes 3.19.2.
- El hash documentado es estable respecto del par secreto/suscriptor; la documentación no define expiración, nonce ni token de sesión temporal. Rotar la Secret Key exige regenerarlo.

Fuentes: [Prepare Inbox for Production](https://docs.novu.co/platform/inbox/prepare-for-production), [API Keys](https://docs.novu.co/platform/developer/api-keys), [API de `@novu/react`](https://docs.novu.co/platform/sdks/react), [metadatos/tipos publicados de `@novu/react` 3.19.2](https://registry.npmjs.org/@novu/react/3.19.2).

### Contrato para U-Roadmaps

- `subscriber = session.user.id`, el UUID canónico ya validado por `requireAuthenticatedUser`; no se crea un identificador alternativo de Novu.
- El servidor autenticado calcula `subscriberHash`. `NOVU_SECRET_KEY` y el cliente `@novu/api` permanecen en módulos server-only; el navegador recibe solo el application identifier, UUID y hash.
- Un usuario no autenticado no monta el Inbox. No se usa el subscriber de ejemplo ni un fallback compartido.
- Si el MVP no usa Contexts de Novu, no necesita `contextHash`. Si luego se usa `context`, HMAC habilitado exige firmar también el contexto canónico.

Esto encaja con el `RootLayout` server-side y el `GlobalNavigation` actual: el layout ya resuelve sesión/usuario y puede pasar identidad y firma a un hijo cliente en el navbar. Fuentes locales: [`layout.tsx`](../../src/app/layout.tsx), [`GlobalNavigation.tsx`](../../src/app/_components/GlobalNavigation.tsx), [`next-auth.d.ts`](../../src/types/next-auth.d.ts).

## 2. SDK que corresponde usar

| Superficie | Paquete | Uso en el MVP |
| --- | --- | --- |
| Inbox Next.js | `@novu/nextjs` 3.19.2 | `<Inbox />`, integración con App Router y exports de hooks/componentes de React. |
| Estado headless | `@novu/react`, transitivo de `@novu/nextjs` | `NovuProvider`, `useNotifications`, `useCounts`, `useNovu` y acciones por notificación. |
| Triggers y Topics | `@novu/api` 3.19.1 | Crear/actualizar suscriptores, membresía de Topics y disparar workflows desde servidor. |
| Workflows como código | `@novu/framework` | No es necesario si el MVP define los workflows en el dashboard; solo sería necesario si se decide versionarlos como código/Bridge. |

El paquete `@novu/nextjs` es un componente cliente aunque se importe desde un árbol App Router. La versión publicada contiene la directiva `"use client"` y adapta la navegación con `next/navigation`. La compatibilidad declarada elimina un conflicto de peers conocido con Next 16/React 19, pero no sustituye un smoke test del bundle real del repositorio. Fuentes: [SDK TypeScript server-side](https://docs.novu.co/platform/sdks/server/typescript), [repositorio oficial del paquete Next.js](https://github.com/novuhq/novu/tree/next/packages/nextjs), [registro npm de `@novu/api`](https://registry.npmjs.org/@novu/api/3.19.1).

## 3. Topics y fan-out

### Garantías documentadas

- Un Topic agrupa suscriptores por un `topicKey` inmutable dentro de un environment.
- Un trigger dirigido a un Topic resuelve la membresía y crea una ejecución de workflow separada por suscriptor.
- Un Topic admite hasta **100.000 suscriptores**.
- Un trigger puede apuntar a varios Topics y Novu deduplica a una persona que pertenezca a más de uno.
- Se pueden excluir subscribers en el trigger sin modificar la membresía.
- Un Topic inexistente puede crearse automáticamente al agregarle suscriptores.
- Las preferencias/subscriptions se evalúan además de la membresía; un Topic por sí solo no fuerza la entrega, salvo que el workflow se marque `critical`.

Fuentes: [Topics](https://docs.novu.co/platform/concepts/topics), [Trigger Workflow](https://docs.novu.co/platform/workflow/trigger-workflow), [Subscription preferences](https://docs.novu.co/platform/subscription), [Workflows críticos](https://docs.novu.co/platform/concepts/workflows).

### Consecuencia para el MVP

Un Topic por oferta de curso es el mecanismo nativo de fan-out, pero su población debe reflejar las participaciones activas que U-Roadmaps ya autoriza. No existe una garantía documentada de sincronización transaccional entre PostgreSQL y Novu, de orden global entre ejecuciones del fan-out ni de entrega exactamente una vez. Por tanto, bajo la política best-effort acordada, la mutación del Roadmap se confirma primero y luego se dispara Novu; la actividad de Novu permite observar ejecuciones y errores, pero una caída entre ambos pasos puede perder la notificación.

## 4. Digest y detalle disponible en el cliente

### Lo que Digest sí hace

- Agrupa por `subscriberId` dentro de un workflow; opcionalmente agrega una clave proveniente del payload.
- La ventana puede ser Regular o Scheduled.
- En Regular, `When events repeat` entrega el primer evento inmediatamente si no hay uno similar reciente y digiere las repeticiones posteriores. La UI ofrece presets de 5 y 30 minutos y una duración custom.
- Al finalizar, los pasos posteriores reciben `events[]`; cada evento contiene `id`, `time` y el payload original. En workflows del dashboard también existen `steps.<digest>.events` y `eventCount` para renderizar el resumen.

Fuentes: [Configure Digest](https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/digest), [Digest Step Reference](https://docs.novu.co/framework/typescript/steps/digest), [Personalize Content: Digest variables](https://docs.novu.co/platform/workflow/add-notification-content/personalize-content).

### Lo que recibe el Inbox

El objeto `Notification` del cliente expone `subject`, `body`, `data`, redirect/actions, workflow/tags/severity, estados y timestamps. No expone `digest.events` ni el payload crudo del trigger. El arreglo digerido existe durante la ejecución para construir el paso posterior; solo llega al navegador aquello que ese paso proyecta en el mensaje o en `notification.data`.

El `data` del paso In-App:

- admite hasta **10 propiedades**;
- solo admite valores escalares (`string`, `number`, `boolean`, `null`);
- limita strings a **256 caracteres**;
- queda disponible para render y filtros en el cliente;
- no debe contener secretos ni una copia indiscriminada del payload.

Fuente: [Inbox Data Object](https://docs.novu.co/platform/inbox/configuration/data-object).

### Restricción funcional

El diálogo del MVP puede mostrar el detalle que tenga cada notificación o Digest, pero Novu no le entrega automáticamente una lista exhaustiva de los cambios agrupados. Tampoco realiza consolidación semántica ni calcula un estado neto.

Hay una tensión que debe resolverse en prototipo: el Digest sin clave adicional agrupa por suscriptor y workflow. Si un solo workflow recibe cambios de varios Roadmaps/nodos, puede agruparlos juntos. Agrupar nativamente por `roadmapId` preserva el indicador de Roadmap, pero no permite deducir todos los nodos afectados desde el cliente. Agrupar por `nodeId` preserva el indicador granular de nodo, pero produce un digest por nodo. Codificar una lista de nodos en un string de `data` no es robusto por el límite de 256 caracteres y queda fuera del contrato recomendado.

## 5. Seen, read, filtros y conteos

### Semántica documentada

- `seen`: el usuario visualizó la notificación.
- `read`: el usuario confirmó/leyó la notificación.
- El modelo expone `isSeen`, `isRead`, `firstSeenAt` y `readAt`; las notificaciones permiten `seen()`, `read()` y `unread()`.
- `useNotifications` pagina y filtra por `read`, `seen`, `archived`, `snoozed`, tags, pares de `data`, severidad y rango de creación.
- `useCounts` acepta varios filtros y devuelve un conteo por filtro; los conteos pueden ser de no leídas, no vistas, total o severidad, y también combinar tags/`data`.
- El cliente JavaScript permite `readAll({ data, tags })` y `markAsSeen({ notificationIds, data, tags })`; por tanto se pueden reconocer lotes por Roadmap o nodo sin una tabla local.
- Las listas y los conteos se actualizan en tiempo real cuando llega una notificación o cambian seen/read/archive/snooze.

Fuentes: [In-App Step result](https://docs.novu.co/framework/typescript/steps/inApp), [`useNotifications`](https://docs.novu.co/platform/sdks/react/hooks/use-notifications), [`useCounts`](https://docs.novu.co/platform/sdks/react/hooks/use-counts), [Mark notifications as seen](https://docs.novu.co/api-reference/subscribers/mark-notifications-as-seen), [Mark as read](https://docs.novu.co/api-reference/subscribers/mark-a-notification-as-read), [Headless mode](https://docs.novu.co/platform/inbox/headless-mode).

### Contrato mínimo de `data`

Para que Novu sea la única persistencia del MVP y aun así habilite indicadores y reconocimiento granular, cada paso In-App debe reservar propiedades escalares estables:

| Campo | Uso |
| --- | --- |
| `roadmapId` | Filtrar/conteo del Roadmap y Resumen académico. |
| `courseCode`, `year`, `semester` | Resolver deep link y asociar la oferta académica sin depender del título. |
| `targetKind` | Distinguir `roadmap` de `node`. |
| `nodeId` | Indicador/reconocimiento del nodo cuando el mensaje representa uno; se omite en resúmenes puramente de Roadmap. |
| `changeKind` | Presentación y filtrado del tipo semántico. |
| `occurredAt` | ISO-8601 de la mutación de dominio cuando el mensaje representa un cambio individual. |

Son ocho propiedades como máximo en una notificación de nodo, dentro del límite de diez. Títulos y descripción deben ir en `subject`/`body`, no duplicarse en `data` salvo necesidad demostrada.

## 6. Timestamps

El cliente actual expone:

- `createdAt`: creación de la notificación en Novu;
- `deliveredAt[]`: instantes de entrega registrados;
- `firstSeenAt`, `readAt`, `archivedAt` y `snoozedUntil`.

Fuentes: [`useNotifications` y tipo Notification](https://docs.novu.co/platform/sdks/react/hooks/use-notifications), [respuesta de Mark as read](https://docs.novu.co/api-reference/subscribers/mark-a-notification-as-read).

`createdAt` no está documentado como el instante de la mutación en U-Roadmaps. Para una notificación individual, el trigger debe incluir `occurredAt` y el paso In-App proyectarlo a `data`; el UI puede mostrar esa fecha y caer a `createdAt` si falta. En un Digest, cada evento tiene `time` dentro del workflow, pero el cliente no recibe esas horas salvo proyección explícita. Si el MVP no construye una lista propia, un Digest solo puede mostrar la fecha/hora del resumen o escalares seleccionados, no todas las horas individuales.

## 7. Tiempo real

Novu documenta que `useNotifications` y `useCounts` escuchan cambios por WebSocket. El cliente también emite:

- `notifications.notification_received`, con la notificación nueva;
- `notifications.unread_count_changed`, con total y desglose por severidad;
- `notifications.unseen_count_changed` en los tipos publicados 3.19.2.

Fuentes: [Headless mode](https://docs.novu.co/platform/inbox/headless-mode), [Introduction to Inbox](https://docs.novu.co/platform/inbox), [metadatos/tipos publicados de `@novu/js` 3.19.2](https://registry.npmjs.org/@novu/js/3.19.2).

La garantía cubre el estado de Novu. No existe una relación automática con el estado React del Roadmap. El código local hoy carga el Roadmap por HTTP y dispone internamente de una función `refresh`, pero no tiene WebSocket/SSE propio. El ADR posterior debe decidir cómo conectar `notification_received` con esa recarga y qué hacer si el nodo seleccionado fue ocultado o eliminado. Fuentes locales: [`http-persistence.ts`](../../src/features/roadmap/session/http-persistence.ts), [`session.tsx`](../../src/features/roadmap/session/session.tsx).

## 8. Regiones y URLs

- US es la región por defecto; el Inbox puede omitir overrides.
- Para EU, la guía de producción actual indica `apiUrl="https://eu.api.novu.co"` y `socketUrl="wss://eu.socket.novu.co"`.
- El SDK server-side usa `serverURL="https://eu.api.novu.co"` para EU.
- Hay deriva documental: Setup Inbox aún muestra la prop `backendUrl`, mientras los tipos 3.19.2 la marcan deprecada a favor de `apiUrl`. El MVP debe usar `apiUrl` con la versión fijada y confirmar el resultado en el smoke test.
- La región corresponde al workspace/environment de Novu, no a la ubicación del estudiante. No se debe seleccionar por geolocalización del usuario.

Fuentes: [Prepare for Production](https://docs.novu.co/platform/inbox/prepare-for-production), [Setup Inbox](https://docs.novu.co/platform/inbox/setup-inbox), [SDK TypeScript server-side](https://docs.novu.co/platform/sdks/server/typescript).

## 9. Retención y límites relevantes

| Restricción | Free | Pro | Team | Enterprise |
| --- | ---: | ---: | ---: | ---: |
| Retención del Inbox | 30 días | 90 días | 90 días | Custom |
| Retención del Activity Feed | 1 día | 7 días | 90 días | Custom |
| Duración máxima de Digest | 1 día | 7 días | 30 días | Custom |
| Workflows | 20 | 20 | 100 | Custom |
| Pasos por workflow | 20 | 20 | 20 | Custom |

Otros límites:

- Topic: hasta **100.000 subscribers**.
- Trigger: payload total de **512 KiB**.
- In-App `data`: **10 escalares**, strings de **256 caracteres**.
- Rate limit de Events: **60 / 240 / 600 / 6.000 RPS** en Free / Pro / Team / Enterprise.
- Rate limit de Configuration, que incluye Subscribers y Topics: **20 / 80 / 200 / 2.000 RPS**.
- Las solicitudes bulk consumen 100 tokens del bucket correspondiente.

Fuentes: [Limits](https://docs.novu.co/platform/developer/limits), [Payload limits](https://docs.novu.co/api-reference/payload-limits), [Rate limiting](https://docs.novu.co/api-reference/rate-limiting), [Topics](https://docs.novu.co/platform/concepts/topics), [Inbox Data Object](https://docs.novu.co/platform/inbox/configuration/data-object).

Consecuencia: si los indicadores dependen solo de Novu, desaparecen al expirar la retención del feed aunque el estudiante nunca los haya leído. Esto es coherente con la decisión de no agregar persistencia paralela al MVP, pero debe figurar como limitación visible, no como historial permanente.

## 10. Prototipos obligatorios antes de cerrar el diseño de implementación

1. **Compatibilidad y autenticación:** instalar versiones fijadas de `@novu/nextjs` y `@novu/api`, compilar con Next 16.3/React 19.2, montar la campana en `GlobalNavigation`, verificar HMAC válido/inválido y confirmar que la Secret Key nunca aparece en el bundle.
2. **Región:** probar US sin overrides o EU con `apiUrl`/`socketUrl`, según el workspace real. Confirmar que no se requiere el alias deprecado `backendUrl`.
3. **Digest real:** configurar `When events repeat` y observar la secuencia exacta: primer mensaje inmediato, resumen posterior, `subject`/`body`/`data`, `createdAt`, conteos y qué ocurre al mezclar Roadmaps/nodos. Elegir `roadmapId`, `nodeId` o sin clave según cuál conserve los indicadores requeridos.
4. **Reconocimiento granular:** con dos Roadmaps y varios nodos, filtrar y contar por `data`, marcar el diálogo como seen y el nodo/Roadmap correspondiente como read, y verificar que los indicadores de navbar, nodo y Resumen académico cambian en todas las pestañas abiertas.
5. **Topics:** agregar/quitar participaciones activas, disparar inmediatamente después del cambio de membresía, verificar deduplicación y comprobar que quien dejó el curso no recibe el evento.
6. **Roadmap abierto:** dos sesiones concurrentes; el docente crea, edita, oculta, bloquea y elimina, mientras el estudiante recibe `notification_received`. Verificar el refetch, conservación de selección y cierre del panel si el nodo deja de ser accesible. Esto valida comportamiento de U-Roadmaps, no una garantía de Novu.
7. **Fallos best-effort:** simular timeout/429 después de confirmar la mutación y verificar logging/observabilidad sin revertir ni reportar falsamente la edición como fallida.

## Conclusión para el mapa

El contrato oficial permite construir el MVP sin tabla local de notificaciones: HMAC sobre el UUID autenticado, Topics por oferta, triggers server-side, Inbox/Headless sobre `@novu/nextjs`, `data` escalar para IDs y reconocimiento granular, y WebSocket como señal de refetch. El alcance debe aceptar retención finita, entrega best-effort y detalle de Digest limitado a la proyección del workflow.

La única decisión técnica que la documentación no puede cerrar es la granularidad del Digest. El comportamiento nativo por suscriptor puede entrar en conflicto con indicadores por nodo; se necesita el prototipo con datos reales antes de fijar la clave de agrupación y el contrato final del diálogo.
