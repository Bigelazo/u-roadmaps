# Consolidación de notificaciones con Novu

**Fecha de revisión:** 2026-09-17  
**Alcance:** capacidades oficiales actuales de Novu para agrupar, deduplicar, cancelar y actualizar notificaciones del Inbox. La pregunta concreta es cuánto de la política «primer cambio inmediato, repeticiones cortas consolidadas y resultado neto final» puede delegarse a Novu.

## Conclusión

Novu resuelve de forma nativa una parte importante del transporte: entrega inmediata al Inbox, actualización en tiempo real del feed y contadores, fan-out a participantes mediante Topics, idempotencia de reintentos y digest por suscriptor con una clave adicional —por ejemplo, `roadmapId` o `nodeId`—. Su modo **Regular / When events repeat** es especialmente cercano al caso: el primer evento se entrega inmediatamente y las repeticiones posteriores dentro de una ventana pasan a un digest.

No resuelve la semántica de dominio solicitada. El digest acumula eventos; no compara el estado inicial y final, no reemplaza el contenido de una notificación ya entregada y no cancela automáticamente un cambio que vuelve al valor original. U-Roadmaps debe conservar el cambio detallado como fuente de verdad, decidir si una secuencia representa un cambio neto y usar Novu solo para entregar o retirar el resumen correspondiente.

Por lo tanto, **Novu puede reducir ruido, pero no debe ser el motor de consolidación semántica**. La alternativa nativa más cercana genera un primer mensaje inmediato y, más tarde, otro mensaje agrupado; no mantiene un único mensaje mutable durante los 60 segundos.

## Qué ofrece Novu

### Digest regular, repetido y programado

El paso Digest agrupa múltiples ejecuciones de un workflow y ejecuta los pasos posteriores una sola vez por ventana. La documentación actual ofrece dos ventanas visibles:

- **Regular:** reúne eventos durante segundos, minutos, horas, días, semanas o meses y entrega al terminar.
- **Scheduled:** reúne hasta un instante fijo —cada minuto, hora, día, semana o mes— y usa la zona horaria del suscriptor.

En Regular se puede iniciar el digest:

- **Immediately:** el primer evento también espera la ventana.
- **When events repeat:** si no hay un evento similar reciente, entrega inmediatamente; si lo hay, inicia un digest para las repeticiones. Hay presets de 5 y 30 minutos y una duración personalizada.

Esto cubre «primer cambio inmediato y repeticiones posteriores agrupadas», pero los eventos repetidos se entregan después de la ventana; no actualizan el mensaje inicial. Fuente: [Digest Step](https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/digest).

La nomenclatura tiene una transición que conviene no exponer en el diseño de dominio. La UI y la documentación actuales hablan de `Regular` y `Scheduled`; el esquema actual de configuración representa esto como `regular | timed` y `lookBackWindow`, mientras que los metadatos de actividad todavía pueden informar `regular | backoff | timed`. En consecuencia, **backoff no debe modelarse como una tercera política funcional propia de U-Roadmaps**: es la denominación histórica/interna de la variante de repetición o look-back del digest regular. Fuentes: [Retrieve a workflow](https://docs.novu.co/api-reference/workflows/retrieve-a-workflow), [List all events](https://docs.novu.co/api-reference/notifications/list-all-events).

### Clave y alcance de agrupación

Digest agrupa por `subscriberId` de manera predeterminada y permite una clave de agregación adicional proveniente del payload. En Framework, `digestKey` forma el bucket por la combinación `subscriberId + digestKey`. Por ello se puede aislar, por ejemplo, un digest por estudiante y Roadmap, o por estudiante, nodo y clase de cambio. Fuentes: [Digest Step](https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/digest), [Digest Step Reference](https://docs.novu.co/framework/typescript/steps/digest).

El workflow ya delimita la ejecución: un Digest es un paso dentro de un workflow, no una agregación global entre workflows. Un Topic tampoco es una clave de digest; es un mecanismo de destinatarios. Novu resuelve el Topic, hace fan-out y ejecuta el workflow separadamente para cada suscriptor. Si el mismo suscriptor pertenece a varios Topics incluidos en un único trigger, Novu lo deduplica y lo notifica una sola vez. Fuente: [Trigger Workflow](https://docs.novu.co/platform/workflow/trigger-workflow).

Implicación para el proyecto:

- Un Topic por audiencia activa del curso es apropiado para fan-out.
- `roadmapId` es una clave razonable si se quiere el resumen general «Hay cambios en este Roadmap».
- `nodeId + changeClass` es necesaria si se pretende consolidar por propiedad del nodo.
- Ninguna de esas claves calcula por sí sola si `oculto → visible → oculto` equivale a un único cambio o si `A → B → A` debe desaparecer.

### Throttle como alternativa de supresión

El paso Throttle permite continuar solo un número configurable de ejecuciones durante una ventana fija o dinámica. Agrupa por `subscriberId` y admite una segunda clave proveniente del payload. Una vez alcanzado el umbral, las ejecuciones posteriores se detienen y los pasos siguientes se omiten. Fuente: [Throttle Step](https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/throttle).

Throttle sirve para «a lo sumo una notificación por nodo cada minuto», pero no para el requisito completo: descarta repeticiones en vez de conservar el último estado, no produce el resumen final y tampoco retira el primer mensaje si la edición vuelve al valor original.

### Idempotencia y duplicados técnicos

Novu ofrece `Idempotency-Key` para reintentar de forma segura solicitudes `POST` y `PATCH`. El control ocurre antes de encolar el trigger: solicitudes repetidas con la misma clave y el mismo cuerpo devuelven la respuesta cacheada y cuentan como una sola ejecución. Una repetición concurrente devuelve `409`; reutilizar la clave con un cuerpo distinto devuelve `422`. La clave admite hasta 255 caracteres, se conserva 24 horas para respuestas exitosas o fallidas y requiere que la funcionalidad esté habilitada para la organización. Fuente: [Idempotency](https://docs.novu.co/api-reference/idempotency).

El `transactionId` del trigger sirve para correlación, cancelación y una deduplicación posterior durante el procesamiento, pero la propia documentación recomienda `Idempotency-Key` para reintentos y protección de facturación. No se debe reutilizar la misma clave para cambios semánticamente distintos: además de ser conceptualmente incorrecto, un payload distinto provocaría `422`.

Aplicación recomendada: usar como idempotency key el identificador persistente del evento/outbox de U-Roadmaps. Esto elimina duplicados causados por reintentos de entrega, pero **no** consolida varias ediciones reales hechas por el docente.

### Cancelar, retirar y cambiar una notificación

Novu distingue operaciones diferentes:

- Cancelar por `transactionId` detiene workflows todavía activos o pendientes, incluidos Digest y Delay. No retracta un workflow ya entregado. Fuente: [Cancel triggered event](https://docs.novu.co/api-reference/events/cancel-triggered-event).
- Una notificación Inbox ya creada puede eliminarse permanentemente por `subscriberId + notificationId`. Fuente: [Delete a notification](https://docs.novu.co/api-reference/subscribers/delete-a-notification).
- También se pueden eliminar mensajes por `messageId` o todos los mensajes asociados a un `transactionId`, opcionalmente filtrados al canal `in_app`. Fuentes: [Delete a message](https://docs.novu.co/api-reference/messages/delete-a-message), [Delete messages by transactionId](https://docs.novu.co/api-reference/messages/delete-messages-by-transactionid).
- Archivar oculta una notificación sin eliminarla, y el SDK permite marcarla como leída, vista, archivada, pospuesta o borrada. Fuentes: [Archive a notification](https://docs.novu.co/api-reference/subscribers/archive-a-notification), [`useNotifications`](https://docs.novu.co/platform/sdks/react/hooks/use-notifications).

No hay en la API pública documentada una operación para reemplazar `subject`, `body` o `data` de una notificación Inbox ya entregada. El patrón disponible es retirar/archivar y, si aún corresponde, disparar otra notificación. Eso crea una entidad y un `createdAt` nuevos, por lo que no equivale a actualizar el mensaje original.

La eliminación masiva por `transactionId` es útil si un único trigger a Topic produjo todos los mensajes de una operación y el cambio vuelve al estado original. Sin embargo, antes de basar la UX en una retractación instantánea, debe verificarse en un prototipo que la eliminación iniciada en servidor se propague por WebSocket a todos los Inbox abiertos; la documentación garantiza actualizaciones en tiempo real del feed y de estados, pero no declara explícitamente el evento de eliminación remota.

### Inbox en tiempo real

`<Inbox />` se conecta al entorno mediante `applicationIdentifier` y suscriptor, y Novu proporciona un endpoint WebSocket específico. Los hooks `useNotifications` y `useCounts` escuchan eventos en tiempo real; el cliente también expone `notifications.notification_received` y `notifications.unread_count_changed` para reaccionar, por ejemplo, con un toast no bloqueante. Fuentes: [Set up the Inbox](https://docs.novu.co/platform/inbox/setup-inbox), [Headless Mode](https://docs.novu.co/platform/inbox/headless-mode), [API Keys](https://docs.novu.co/platform/developer/api-keys).

Esto actualiza el **Inbox y sus contadores**. No implica que el modelo del Roadmap, los nodos renderizados o sus archivos se refresquen en tiempo real. U-Roadmaps todavía necesita verificar el comportamiento actual y decidir en un ADR si, al recibir el evento de Novu, invalida/refetch la consulta del Roadmap o si implementa otra propagación de datos. El WebSocket de Novu puede servir como señal de «hay cambios», pero el servidor de U-Roadmaps sigue siendo la autoridad del contenido.

### Timestamps

La notificación del Inbox expone `createdAt`, `deliveredAt`, `readAt`, `firstSeenAt`, `archivedAt` y `snoozedUntil`; `renderNotification` permite presentar `createdAt`. Fuentes: [Mark a notification as read](https://docs.novu.co/api-reference/subscribers/mark-a-notification-as-read), [`@novu/react`](https://docs.novu.co/platform/sdks/react).

`createdAt` es la creación de la notificación en Novu, no necesariamente el momento del cambio de dominio. Para cumplir «fecha y hora del cambio», U-Roadmaps debe persistir `occurredAt` y `effectiveUpdatedAt` y pasar solo el timestamp necesario en `notification.data`; el Inbox puede renderizarlo de forma personalizada. El objeto `data` está disponible en cliente y admite tipado, pero Novu recomienda no copiar payloads sensibles completos. Fuente: [Data Object](https://docs.novu.co/platform/inbox/configuration/data-object).

En una consolidación, el diálogo debería mostrar cada `occurredAt`; el resumen debería mostrar `effectiveUpdatedAt`, es decir, la hora del último cambio efectivo. Esto evita depender de la hora de una eliminación/reemisión en Novu.

## Evaluación contra la política propuesta

| Necesidad | Novu nativo | Lógica de U-Roadmaps |
| --- | --- | --- |
| Primer cambio visible de inmediato | Sí: trigger directo o Digest Regular con `When events repeat`. | Persistir el cambio y disparar mediante outbox/idempotency key. |
| Actualización en vivo de campana/feed | Sí: Inbox, WebSocket, `useNotifications`, `useCounts`. | Vincular el evento con indicadores del Roadmap y refetch de datos. |
| Agrupar repeticiones durante 60 s | Parcial: Digest por suscriptor + `digestKey` y ventana personalizada. | Elegir `roadmapId/nodeId/changeClass`; aceptar que el resumen posterior no reemplaza el primero. |
| Mantener un único mensaje que cambia durante 60 s | No hay API pública para editar contenido ya entregado. | Mantener estado local; retirar y reemitir si se decide reflejarlo en Inbox. |
| Convertir `ocultar → mostrar → ocultar` en un cambio neto | No. Digest retiene eventos, no reduce estados. | Comparar estado base/final por entidad y clase de cambio. |
| Cancelar `A → B → A` | Parcial: cancelar solo lo pendiente; borrar/archivar lo entregado. | Detectar la reversión, cancelar/retirar el resumen y cerrar el cambio local. |
| Evitar duplicados por retry | Sí: `Idempotency-Key`; `transactionId` como correlación/cancelación. | ID estable de evento/outbox y política de reintentos. |
| Fecha/hora del cambio | Parcial: Novu expone fechas de notificación. | `occurredAt/effectiveUpdatedAt` canónicos, enviados en `data`. |

## Recomendación para el plan

1. Mantener una tabla local de cambios del Roadmap y una tabla/outbox de entregas. Novu no reemplaza ninguna de las dos.
2. Para el MVP, enviar cada cambio semántico inmediatamente a Novu con una idempotency key estable. Esto preserva el requisito de tiempo real y permite medir ruido real antes de introducir una ventana.
3. Prototipar **Regular / When events repeat** con ventana personalizada de 60 segundos y `digestKey = roadmapId + nodeId + changeClass`. Validar si la UX aceptable es «primer mensaje inmediato + resumen posterior»; esa es la semántica nativa, no «un único mensaje actualizado».
4. Si se exige un único mensaje y estado neto, implementar la ventana de consolidación en U-Roadmaps. Novu recibiría solo el evento consolidado, o se usaría eliminación/reemisión sabiendo que cambia `createdAt` y debe verificarse la propagación de la retractación.
5. Registrar en el ADR de tiempo real que el socket de Novu actualiza Inbox/contadores, pero no constituye prueba de actualización en vivo del Roadmap. Incluir pruebas con dos sesiones abiertas: docente edita, estudiante recibe, el Roadmap se invalida/refresca y una eliminación remota del mensaje desaparece del Inbox.

## Límites relevantes

- Payload máximo por trigger: **512 KB**. Fuente: [Payload Limits](https://docs.novu.co/api-reference/payload-limits).
- `notification.data`: hasta **10 propiedades escalares** por paso in-app; strings de hasta **256 caracteres**. Fuente: [Data Object](https://docs.novu.co/platform/inbox/configuration/data-object).
- Trigger bulk: hasta **100 eventos por solicitud**; no cambia la semántica individual de cada evento. Fuente: [Bulk trigger event](https://docs.novu.co/api-reference/events/bulk-trigger-event).
- Rate limit de Events: **60 / 240 / 600 / 6000 RPS** para Free / Pro / Team / Enterprise; una solicitud bulk cuesta 100 tokens. Fuente: [Rate Limiting](https://docs.novu.co/api-reference/rate-limiting).
- Duración máxima de Digest: **1 día / 7 días / 30 días / custom** según plan. Retención de Inbox: **30 / 90 / 90 días / custom**. Fuente: [Limits](https://docs.novu.co/platform/developer/limits).
- Idempotency key: **255 caracteres**, cache de **24 horas**, conflicto en progreso retenido hasta **5 minutos**, y disponibilidad sujeta a habilitación de la organización. Fuente: [Idempotency](https://docs.novu.co/api-reference/idempotency).

Una ventana de 60 segundos cabe holgadamente en los límites de Digest, pero la retención del Inbox confirma otra razón para conservar el historial detallado y su reconocimiento en PostgreSQL: Novu no es el archivo permanente del Roadmap.
