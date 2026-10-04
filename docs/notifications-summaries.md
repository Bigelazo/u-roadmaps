# Resúmenes de cambios propios

Las cinco clases del catálogo pasan por `deliverGroupedNotice`: disponibilidad,
Nodos (contenido y acceso), Recursos, Dependencias y clasificación. Todas usan
PostgreSQL y la misma publicación SSE, sin servicios externos ni un Inbox abierto.

Cada grupo corresponde a Usuario, Roadmap, Nodo cuando existe y clase. El autor
y el tipo concreto de cambio no dividen el grupo. El primer aviso se guarda
inmediatamente e inicia una ventana fija de 60 segundos. Las repeticiones se
guardan juntas en otro aviso al cerrar esa ventana, incluso si no llega otra
edición. Una sola repetición produce un resumen de un cambio. El primer aviso
no cuenta entre las repeticiones ni se modifica.

`NoticeDeliveryEffect` registra las identidades aceptadas por destinatario,
incluidas las repeticiones sin fila individual. La aceptación y la publicación
del primer aviso son una transacción; entregar de nuevo un efecto no incrementa
el grupo, ni siquiera después del cierre. La migración incorpora los avisos
anteriores a esos registros de idempotencia.

Las ventanas y sus temporizadores viven en el proceso Node de la aplicación y se
comparten entre los módulos de rutas de Next. Requieren un proceso de aplicación
persistente. La operación vigente admite un único proceso Node: no coordina ventanas entre
réplicas ni recupera repeticiones tras una caída. No añade recuperación durable. Un fallo al
guardar un resumen se informa sin afectar la edición del Roadmap.

El resumen conserva cantidad de repeticiones y contexto del último cambio según
su instante efectivo. Identifica a su autor como autor del último cambio, no de
toda la agrupación. Reutiliza la proyección y los ejemplos de mensajes, sin el
límite de 256 caracteres exclusivo de Novu. No enumera eventos ni calcula un
estado neto y permanece guardado sin caducidad.

Primeros avisos y resúmenes se publican en `RoadmapNotice`; su trigger existente
emite la misma invalidación de Inbox para SSE. Inbox, diálogo, contadores y
reconocimiento usan la identidad de esa fila. La apertura de Nodo captura solo
los avisos ya publicados: un resumen publicado después sigue pendiente incluso
si se reintenta el reconocimiento de aquella apertura.

Los refrescos del Inbox conservan sus páginas expandidas. Las señales de
publicación, lectura o visibilidad de filas vuelven a consultar esas páginas sin
reducir la lista a sus diez primeros avisos; así un resumen nuevo no impide
consultar avisos anteriores.

## Revisión y validación del 2026-10-04

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
