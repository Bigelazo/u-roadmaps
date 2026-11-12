---
status: accepted
date: 2026-11-11
---

# Los Avisos aparecen al cargar la página, sin tiempo real

La campana y las campanas por curso se mantenían en vivo: un disparador en `RoadmapNotice` emitía una señal `inbox` por SSE, cada cambio de Roadmap emitía otra, y el cliente volvía a pedir los conteos al recibir `ready`, al volver a la pestaña, al recuperar la conexión y al montar los componentes. Como el servidor cierra el canal cada cinco minutos, el panorama académico repetía varias ráfagas de una petición por curso más dos generales, aunque nadie hubiera recibido Avisos nuevos. Decidimos que los Avisos no son en tiempo real para nadie.

La página obtiene en el servidor, una sola vez por carga, una instantánea de la bandeja propia (`readOwnInbox`): el total pendiente, el pendiente por oferta de curso y la lista completa de Avisos pendientes ya agrupada. El acceso del destinatario se calcula una vez para todos sus Roadmaps y los conteos salen de una sola consulta agrupada por Roadmap, con las mismas reglas de visibilidad que la bandeja. El cliente guarda esa instantánea y solo la descuenta cuando reconoce un Roadmap, de modo que la campana y la campana del curso bajan sin pedir nada al servidor. Un Aviso nuevo aparece al recargar la página.

El canal SSE se conserva solo para las señales de Roadmap: el lienzo docente se recarga con los cambios de otros docentes y la pérdida de acceso redirige al panorama académico. El disparador `own_inbox_changed` y la función `notify_own_inbox()` se eliminan, y desaparece `GET /api/notifications/counts`. `GET /api/[courseCode]/[year]/[semester]/notifications/count` se mantiene porque lo consume la extensión de U-Cursos.

## Consecuencias

- Un estudiante con la página abierta no ve los Avisos que lleguen después de cargarla hasta que recarga o navega con carga completa.
- Las marcas de cambios de los Nodos ya no se refrescan en vivo cuando otro docente edita; se actualizan al recargar.
- La bandeja muestra la lista completa sin paginar, porque los Avisos pendientes se agrupan por Roadmap y su cantidad queda acotada por los cursos activos.
- Volver a un aviso en tiempo real requeriría reintroducir una señal propia, no solo reabrir el canal existente.
