# Entrega de cambios propios

El agrupador de ventanas de 60 segundos se retiró en #168. Cada efecto aceptado
se guarda inmediatamente como un Aviso del roadmap independiente, también si
repite el mismo Nodo o aspecto. No se publica un aviso de resumen separado.
La agrupación por Objeto del aviso y el Resumen de cambios acordados en
[ADR-0014](adr/0014-target-based-notice-grouping.md) siguen pendientes de
implementación; esta entrega inmediata es el comportamiento transitorio.

Las cinco clases del catálogo (disponibilidad, Nodos, Recursos, Dependencias y
clasificación) usan `deliverNotice`, PostgreSQL y la misma publicación SSE,
sin servicios externos ni necesidad de tener abierto el Inbox.
`NoticeDeliveryEffect` registra cada identidad de evento por destinatario;
aceptar el efecto y guardar su aviso ocurre en una transacción. Entregar el
mismo efecto otra vez no crea otro aviso. No hay temporizadores ni repeticiones
pendientes en memoria; los avisos confirmados sobreviven al reinicio de Node.
Los errores de entrega no revierten la edición docente. No hay outbox ni
recuperación durable de efectos que no llegaron a guardarse.

Cada aviso conserva el contexto y el autor de su cambio. La apertura de Nodo
captura solo los avisos publicados en ese instante: un cambio posterior sigue
pendiente incluso al reintentar el reconocimiento de aquella apertura. Los
refrescos SSE del Inbox mantienen las páginas expandidas y todos los avisos
anteriores. El reconocimiento y el estado visto mantienen sus contratos
vigentes hasta implementar ADR-0014.

El spec `own-notification-summaries.spec.ts` conserva el recorrido sin Inbox
abierto, la inmutabilidad de los avisos anteriores, la llegada posterior a una
apertura y el reconocimiento desde el navegador, ahora sin esperas ni omisiones.
La validación vigente se registra en [la guía de pruebas](agents/testing.md).

## Antecedente: revisión y validación del 2026-10-04

Se usó `code-review` una vez, con dos revisiones independientes. La revisión de
estándares sugirió extraer la preparación repetida de Nodos existentes; se
resolvió en `tests/e2e/existing-node.ts`, que utiliza el helper SQL compartido y
centraliza valores por defecto y escapado. La revisión de especificación no
encontró requisitos ausentes ni implementaciones incorrectas.

- Tipos y ESLint de los archivos modificados: código de salida 0; se mantienen
  advertencias preexistentes sobre condicionales de limpieza de tests.
- Suite unitaria completa: 64 archivos y 330 pruebas aprobadas, sin fallos ni
  omisiones, en 26,78 segundos y con código de salida 0.
- Recorrido de resumen con la ventana real de 60 segundos, PostgreSQL, Chromium
  y Firefox: dos aprobados en 2,5 minutos, con código de salida 0.
- Recorrido SSE con resumen, visibilidad entre pestañas, reconocimiento y
  reconexión, Chromium y Firefox: cuatro aprobados en 2,3 minutos, con salida 0.
- Suite E2E completa contra PostgreSQL, Chromium y Firefox: 126 aprobados,
  cero fallos y dos omisiones de integraciones Cloud optativas, en 12,6 minutos
  y con código de salida 0, después de resolver la sugerencia de revisión.
