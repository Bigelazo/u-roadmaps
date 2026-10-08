---
status: accepted
date: 2026-10-05
---

# Agrupar avisos por objeto y reconocerlos al entrar al Roadmap

Se reemplaza la ventana fija de 60 segundos que agrupa avisos repetidos
([docs/notifications-summaries.md](../notifications-summaries.md)) por una
agrupación sin tiempo: mientras un aviso esté pendiente, absorbe los cambios
posteriores a su mismo **Objeto del aviso** y muestra solo el estado más reciente.
Se mantiene el objetivo original: **reducir la cantidad de avisos de un Roadmap
cuando recibe múltiples cambios, sobre todo modificaciones repetidas a un mismo
objeto**. El reconocimiento pasa a ocurrir únicamente al entrar al Roadmap, que
muestra una vez un resumen de los cambios. Para estudiantes y observadores el
Roadmap deja de actualizarse en tiempo real (solo los avisos llegan en vivo); el
equipo docente conserva su actualización en vivo.

Especificación acordada en la sesión de grilling del 2026-10-04/05. Los textos
de avisos y del dialog son orientativos; las reglas son vinculantes.

**Modificación del 2026-10-07**, tras revisar la implementación en uso: se retira
el contador del canvas (decisiones 7 y 9), el título de cada fila del Inbox pasa a
ser el nombre del ramo y los avisos de acceso describen lo ocurrido al Nodo
(decisión 13), y el canvas marca cada Nodo con cambios hasta que se abre ese Nodo,
independientemente del reconocimiento (decisión 14).

## Contexto

La ventana actual guarda el primer aviso de inmediato y, si hubo repeticiones del
mismo destinatario, Roadmap, Nodo y clase dentro de 60 segundos, guarda un segundo
aviso «Resumen de cambios» al cerrarse. Sus problemas:

- Las ventanas y temporizadores viven en memoria del proceso Node: un reinicio
  pierde los resúmenes pendientes y no funciona con varias réplicas.
- No reduce avisos de forma sustancial: el primer aviso nunca se reemplaza y el
  resumen se suma a él. Un estudiante ausente una semana acumula un aviso por
  cada ventana.
- Las pruebas E2E deben esperar 60 segundos reales: 8 casos ocupaban ~497 s de
  los 564 s de Chromium en la ejecución del 2026-10-04 (con Firefox, ~16 minutos
  solo de esperas, cerca del `globalTimeout` de 25 minutos).
- Cada aviso guardado, inmediato o resumen, escribe `Roadmap notice saved` por
  destinatario (`grouped-delivery.ts`). Como `playwright.config.ts` usa
  `webServer.stdout: 'pipe'`, cada edición docente de cualquier spec imprime unas
  5 líneas en la salida de las pruebas. Esto motivó la revisión.

## Estado previo frente a lo pedido

Al iniciar la sesión se pidió identificar qué partes de la propuesta ya existían:

| Propuesta                                      | Estado al 2026-10-04                                                                                                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agrupar cambios a un mismo objeto              | Parcial: grupo por destinatario + Roadmap + Nodo + clase, pero con ventana de 60 s y sin reemplazar el primer aviso                                                         |
| Mostrar solo el último cambio                  | No existía: el primer aviso nunca se modifica                                                                                                                               |
| Aviso general «El roadmap ha recibido cambios» | No existía                                                                                                                                                                  |
| Contadores                                     | Existen tres: badge del Inbox, contador por curso en el Resumen académico y contador en el canvas del Roadmap (`RoadmapCanvasView.tsx`); cada aviso pendiente suma 1        |
| Dialog de resumen al entrar al Roadmap         | No existía: entrar reconocía avisos generales sin mostrar nada; el único dialog (`RoadmapAvailabilityDialog`) muestra un aviso y solo al llegar desde el Inbox (`?notice=`) |
| Abrir la campana marca todo como visto         | No: solo marca las filas mostradas                                                                                                                                          |
| Clic en un aviso redirige al Roadmap           | No: abre el Nodo afectado (`targetNode`) y el dialog de ese aviso                                                                                                           |
| Aviso reconocido desaparece del Inbox          | No: queda como leído                                                                                                                                                        |
| Roadmap en tiempo real                         | Sí, para todos, mediante SSE                                                                                                                                                |

## Catálogo actual de cambios que generan avisos

| #   | Acción                                                  | Avisos actuales                                                                                                   |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Crear el Roadmap                                        | `roadmap-available`                                                                                               |
| 2   | Crear Nodo visible                                      | `node-available`                                                                                                  |
| 3   | Editar título, descripción o tipo de un Nodo visible    | `node-updated` con `changedFields`                                                                                |
| 4   | Ocultar o mostrar Nodo                                  | `node-retired` o `node-available`, más avisos en cascada a dependientes que ganan o pierden acceso                |
| 5   | Eliminar Nodo                                           | `node-deleted`, más cascada de acceso                                                                             |
| 6   | Bloqueo docente, Desbloqueo de nodo, Desbloqueo de rama | `node-blocked` o `node-available` en cada Nodo afectado de la cascada, con destinatarios distintos por estudiante |
| 7   | Agregar, editar o quitar Recurso                        | `resource-added`, `resource-updated`, `resource-removed`                                                          |
| 8   | Agregar o quitar Dependencia                            | `dependency-added`, `dependency-removed`, más cascada de acceso                                                   |
| 9   | Renombrar un Tipo de nodo en uso                        | `classification-updated`                                                                                          |
| 10  | Desbloqueo programado (commit `2ebba0d`)                | Los mismos avisos que un desbloqueo manual, atribuidos al equipo docente                                          |

No generan avisos: mover Nodos, reordenar el layout ni que un estudiante complete
un Nodo.

## Decisión

### 1. Objeto del aviso (target)

Un aviso trata de **un único elemento y aspecto**. Cambios a objetos distintos
del mismo Nodo nunca se fusionan, para que un cambio no oculte otro de distinta
naturaleza (por ejemplo, editar la descripción después de bloquear el Nodo no
debe ocultar el bloqueo).

Contenido del Nodo, cada uno con su propio aviso y su propia agrupación:

| Objeto               | Texto orientativo (no definitivo)  |
| -------------------- | ---------------------------------- |
| Título del Nodo      | «X» pasó a llamarse «Y»            |
| Descripción del Nodo | Se actualizó la descripción de «Y» |
| Tipo del Nodo        | «Y» pasó de tipo A a tipo B        |

**Acceso al Nodo** es un único objeto, no dos (visibilidad y bloqueo por
separado). Para el estudiante, un Nodo está en exactamente uno de tres estados:

| Estado     | Origen                                       |
| ---------- | -------------------------------------------- |
| Disponible | Visible y sin bloqueos                       |
| Bloqueado  | Bloqueo docente o Bloqueo por prerrequisitos |
| Retirado   | Oculto (el estudiante no lo ve)              |

El aviso compara el estado anterior conocido con el resultante y describe lo que
le ocurrió al Nodo, por ejemplo _«Colas» fue bloqueado_ para Disponible →
Bloqueado (textos en la decisión 13). Ocultar → mostrar → bloquear sin reconocer
produce un único aviso _Disponible → Bloqueado_. Separar visibilidad y
bloqueo daría avisos contradictorios: bloquear y luego ocultar dejaría a la vez
«fue bloqueado» y «fue retirado», cuando solo «Retirado» está vigente.

**Cascadas de acceso:** cada Nodo cuyo acceso cambia es su propio objeto, aunque
el cambio provenga de un gesto sobre otro Nodo (Bloqueo docente propagado,
Desbloqueo de rama, Dependencia que bloquea por prerrequisito, ocultar un
prerrequisito, Desbloqueo programado). Ejemplo: bloquear «Colas», con 5
dependientes transitivos, deja a Ana 6 avisos de acceso; el volumen lo controla el
aviso agrupado (decisión 7). Se descartó un único aviso por gesto («Colas» y 5
dependientes) porque el estado resultante difiere entre estudiantes según sus
Completions (el texto sería falso para algunos) y porque un desbloqueo posterior
de un solo dependiente no tendría un aviso propio que actualizar.

**Recurso:** cada Recurso es su propio objeto y se trata como una unidad (no un
objeto por campo). Su ciclo de vida se compone mientras el aviso esté pendiente:

| Secuencia antes de reconocer | Aviso resultante (texto orientativo)                              |
| ---------------------------- | ----------------------------------------------------------------- |
| agregado → editado (n veces) | Nuevo recurso «Guía 3» en «Pilas», con el título actual           |
| agregado → eliminado         | Se retira (regla 3b): para el destinatario nunca existió          |
| editado (n veces)            | Se actualizó el recurso «Guía 3» en «Pilas»                       |
| editado → eliminado          | Se eliminó el recurso «Guía 3» de «Pilas», con el título conocido |

En una edición solo se detalla el cambio de título («Guía 3» ahora se llama
«Guía 3 resuelta»); cambios de URL, tipo o archivo no se detallan. Se descartó un
objeto por campo del Recurso: triplicaría avisos sin información útil, pues no se
muestran URLs ni nombres de archivo.

**Dependencia:** el objeto es el **par de Nodos** (prerrequisito → dependiente),
no la Dependencia, porque quitar y volver a agregar crea otra Dependencia con
otro id.

| Secuencia antes de reconocer                  | Aviso resultante (texto orientativo)                         |
| --------------------------------------------- | ------------------------------------------------------------ |
| agregada                                      | «Árboles» ahora requiere «Colas»                             |
| quitada                                       | «Árboles» ya no requiere «Colas»                             |
| agregada → quitada, o quitada → agregada      | Se retira (regla 3b)                                         |
| invertida («Colas» pasa a requerir «Árboles») | Dos pares distintos: uno quitado y otro agregado, dos avisos |

Se mantiene la regla vigente: ocultar o eliminar un Nodo **no** genera avisos de
ruta por las Dependencias eliminadas en consecuencia; lo cubren el aviso de
acceso o la eliminación del Nodo. Los cambios de acceso causados por la
Dependencia se avisan por Nodo (cascadas). Se descartó que las Dependencias no
tengan aviso propio: a quien ya completó «Colas» no le cambia el acceso cuando
«Árboles» pasa a requerirlo, pero su ruta sí cambió.

**Tipo de nodo:** cada Tipo de nodo es su propio objeto, y solo su nombre.

| Secuencia antes de reconocer           | Aviso resultante (texto orientativo)                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| renombrado (n veces)                   | El tipo «Lectura» ahora se llama «Lectura obligatoria», del nombre conocido al actual |
| renombrado → vuelve al nombre conocido | Se retira (regla 3b)                                                                  |
| cambio de ícono o color                | Sin aviso, como hoy                                                                   |

Solo se avisa si el Tipo tiene al menos un Nodo visible (regla vigente); los
Tipos predefinidos no se editan. Renombrar un Tipo no genera avisos por Nodo: un
aviso pendiente «Pilas» pasó de tipo «Lectura» a tipo «Taller» conserva los
nombres que el destinatario conoció, y el renombre del Tipo es un aviso aparte.

**Creación de Nodo:** mientras el aviso de creación esté pendiente, absorbe todos
los avisos posteriores sobre ese Nodo y muestra su estado actual. Es simétrico a
la excepción de eliminación: eliminar absorbe todo lo anterior; crear absorbe
todo lo posterior.

| Secuencia antes de reconocer                                     | Aviso resultante (texto orientativo)                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| creado → cambios de título, descripción, tipo, acceso o Recursos | Un solo aviso «Nuevo Nodo «Pilas»» con el estado actual          |
| creado → eliminado                                               | Se retira: el destinatario nunca lo conoció                      |
| creado → ocultado                                                | Se retira; si luego se muestra, vuelve a ser «Nuevo Nodo»        |
| creado → bloqueado                                               | «Nuevo Nodo «Pilas» (bloqueado)»: un aviso que incluye su acceso |

Se descartó mantener objetos separados para Nodos nuevos: produciría avisos como
«Nodo nuevo» pasó a llamarse «Pilas» sobre un nombre que nunca se conoció.

**Disponibilidad del Roadmap:** mientras el aviso «Roadmap disponible: CC1002»
esté pendiente, absorbe todos los demás avisos de ese Roadmap; el destinatario
nunca conoció una versión anterior. La **primera entrada** al Roadmap no muestra
dialog alguno, ni resumen de cambios ni bienvenida. Después de esa entrada rigen
las reglas normales.

**Excepción:** eliminar un Nodo absorbe todos los avisos pendientes sobre ese Nodo.

### 2. Qué muestra un aviso agrupado

El aviso compara el valor que el destinatario **conoció por última vez** con el
valor actual; los pasos intermedios no se muestran. Ejemplo: «Recursión» →
«Recursividad» → «Recursividad avanzada» sin reconocer produce un único aviso
_«Recursión» pasó a llamarse «Recursividad avanzada»_. La misma regla aplica al
tipo. La descripción no muestra valores.

Hoy `node-updated` solo guarda `changedFields`; la implementación debe conservar
el valor anterior de título y tipo al registrar el cambio.

### 3. Fin de la agrupación: el reconocimiento

Un aviso absorbe cambios a su objeto **mientras esté pendiente**. Ver la fila en
el Inbox no termina la agrupación; reconocerlo sí. Un cambio posterior al
reconocimiento crea un aviso nuevo que compara con el valor ya reconocido. No hay
ventanas, plazos ni temporizadores.

Ejemplo (tres ediciones del título, separadas por minutos):

- Estudiante que nunca abrió el Inbox: un aviso, «Recursión» → «Recursividad avanzada».
- Estudiante que abrió la campana antes de la tercera edición, sin entrar al
  Roadmap: el mismo aviso absorbe el cambio; queda «Recursión» →
  «Recursividad avanzada».
- Estudiante que entró al Roadmap después de la segunda edición: el aviso anterior
  quedó reconocido; recibe uno nuevo, «Recursividad» → «Recursividad avanzada».

### 3b. Cambios que vuelven a lo conocido

Si el estado actual de un objeto vuelve a ser igual al último que el destinatario
conoció, su aviso pendiente **se retira**: desaparece del Inbox, el contador baja
y no aparece en el dialog de resumen. Ejemplos: bloquear y luego desbloquear
«Colas» antes de que Ana entre; renombrar «Pilas» → «Pila» → «Pilas».

Efectos aceptados:

1. Un aviso que el destinatario ya leyó en la campana puede desaparecer sin que
   entre al Roadmap; el badge baja solo.
2. La descripción solo se retira si su texto vuelve a ser **exactamente** el
   conocido; cualquier otra diferencia mantiene el aviso.

Se descartó mantener un aviso del tipo «fue bloqueado y desbloqueado»: para el
destinatario no cambió nada.

### 4. Interacción del usuario con avisos y Roadmap

- **Campana y estado «Visto»:** se elimina el concepto de aviso visto (`seenAt`,
  la acción `seen` y el marcado por fila visible). Hoy no tiene efecto visible: el
  badge y los contadores cuentan avisos pendientes. Abrir la campana no cambia
  ningún número; todos cuentan objetos pendientes hasta entrar al Roadmap.
  Inicialmente se pidió que abrir la campana marcara todo como visto; se descartó
  al constatar que ese estado no aporta nada.
- **Clic en un aviso:** siempre redirige al Roadmap del curso. Nunca abre el Nodo
  afectado, aunque el aviso trate de un Nodo (se elimina `targetNode` de la URL).
- **Dialog de resumen al entrar:** al entrar a un Roadmap con cambios desde la
  última apertura, se muestra **una vez** un dialog con el resumen de todos esos
  cambios. Ocurre igual si se entra desde un aviso, desde el Resumen académico o
  refrescando la página. Sin cambios nuevos no aparece dialog, ni tampoco en la
  primera entrada al Roadmap (ver Disponibilidad del Roadmap en la decisión 1).
- **Reconocimiento:** entrar al Roadmap reconoce **todos** sus avisos pendientes,
  incluidos los de Nodos. Abrir un Nodo ya no reconoce avisos (se retira el
  reconocimiento por apertura de Nodo); solo revisa la marca de cambios de ese
  Nodo en el canvas (decisión 14), que es independiente del Inbox.
- **Inbox:** los avisos reconocidos **desaparecen** del Inbox; no permanecen como
  leídos.
- **Clics repetidos:** volver a hacer clic en un aviso no vuelve a abrir el
  dialog; solo redirige. Que el dialog aparezca depende únicamente de que haya
  cambios desde la última apertura, no de la vía de entrada.

Ejemplo: el docente renombra «Recursión» dos veces, edita la descripción de
«Pilas» y bloquea «Colas». Ana abre la campana, hace clic en
cualquier aviso, llega al Roadmap, ve una vez el dialog con los tres cambios y
los avisos desaparecen de su Inbox. Si sale y vuelve a entrar sin cambios
nuevos, no hay dialog.

### 5. Tiempo real del Roadmap solo para el equipo docente

Para estudiantes y observadores, el Roadmap **no se actualiza en tiempo real** y
no muestra dialogs mientras se está dentro. Para ver cambios hay que volver a
entrar (refrescar o hacer clic en un aviso; la vía no importa). Lo único que
reciben en tiempo real son los avisos (Inbox, contadores).

El equipo docente **conserva** la recarga del Roadmap por SSE
(`ROADMAP_CHANGE_RECEIVED_EVENT`) y la resolución de conflictos del borrador
frente a ediciones remotas, que hoy evita que un docente pise sin saberlo el
título, la descripción o el tipo que cambió otro (esas ediciones no tienen
verificación de concurrencia en el servidor). Aunque su Roadmap se actualice en
vivo, el dialog de resumen solo se abre según las reglas de la decisión 4: al
entrar con cambios desde la última apertura.

Se decidió inicialmente quitar el tiempo real a todos; se retractó en la misma
sesión al constatar que los docentes perderían ediciones en silencio. La
concurrencia de la edición docente se registra aparte en
[ADR-0015](0015-teacher-edit-concurrency-relies-on-realtime.md), ajeno al
sistema de avisos.

### 6. El equipo docente recibe avisos con las mismas reglas

Docentes y ayudantes siguen recibiendo avisos de los cambios hechos por otros
miembros del equipo (nunca de los propios), con las mismas reglas de agrupación,
dialog y reconocimiento que los estudiantes. Se acepta que un docente que vio un
cambio en vivo lo encuentre de nuevo en el dialog de su próxima entrada: es poco
frecuente e inocuo, y le sirve a quien no ha entrado en días.

### 7. Aviso agrupado del Roadmap (3 o más objetos)

Cuando un destinatario tiene **3 o más objetos pendientes en un mismo Roadmap**,
el Inbox muestra una sola fila para ese Roadmap: _El Roadmap de CC1002 ha
recibido cambios_, con el detalle _N cambios_.

- **Se cuenta por Roadmap y por destinatario.** Cada Roadmap tiene su propia
  agrupación; los cambios de CC1002 y MA1001 nunca se suman. Con 2 pendientes en
  cada uno, se ven 4 filas individuales.
- **Se cuentan objetos pendientes**, ya aplicadas absorciones y retiros, no
  ediciones: 12 ediciones sobre 3 objetos cuentan 3; un Nodo nuevo con 5 ediciones
  cuenta 1.
- **Los números muestran objetos:** el badge de la campana y el contador del curso
  en el Resumen académico muestran N (3 en el ejemplo), no 1. El contador del
  canvas se retiró el 2026-10-07 (decisión 9).
- **El umbral rige en ambos sentidos:** si un retiro baja el total de 3 a 2, el
  Inbox vuelve a mostrar 2 filas individuales.
- **«Roadmap disponible» nunca se agrupa:** absorbe todo y siempre cuenta 1.
- El clic en la fila agrupada redirige al Roadmap, como cualquier aviso; el dialog
  de entrada lista los N cambios.

**Orden y fecha:** el Inbox ordena por el cambio más reciente. Cuando un aviso
absorbe un cambio, toma la fecha de ese cambio y sube al principio; la fila
agrupada toma la fecha del cambio más reciente entre sus objetos. Sin estado
«visto», la posición es la única señal de que algo cambió de nuevo. Se descartó
conservar la fecha original: un aviso actualizado el jueves quedaría fechado el
lunes, antes del cambio que describe.

Ejemplo: Ana tiene pendientes el título de «Pilas», el acceso de «Colas» y el
Recurso «Guía 3» de «Árboles» tras 12 ediciones docentes. Ve una fila titulada
con el nombre del ramo, _Estructuras de Datos — El Roadmap ha recibido 3
cambios_ (decisión 13), badge 3, contador del curso 3.

### 8. Contenido del dialog de Resumen de cambios

Texto orientativo para el caso de Ana:

```
Cambios en el Roadmap de CC1002
Desde tu última visita

«Pilas y colas» (antes «Pilas»)
  • «Pilas» pasó a llamarse «Pilas y colas»
  • Se actualizó la descripción
  • Nuevo recurso «Guía 3»
«Colas»
  • Pasó de Disponible a Bloqueado
Nuevo Nodo «Árboles»
Ruta y clasificación
  • «Colas» ahora requiere «Pilas y colas»
  • El tipo «Lectura» ahora se llama «Lectura obligatoria»
                                              [ Entendido ]
```

1. **Agrupado por Nodo:** los objetos de un mismo Nodo van juntos bajo su título
   actual; Dependencias y Tipos de nodo van en una sección general al final.
2. **Orden por cambio más reciente**, como el Inbox.
3. **Sin autores:** una absorción puede mezclar ediciones de varios docentes.
4. **Sin navegación:** los ítems no son clicables. La marca de cambios de la
   decisión 14 señala en el canvas los Nodos afectados; centrar el Nodo queda
   para una iteración posterior.
5. **«Desde tu última visita» sin fecha ni hora.**
6. **Un único botón, _Entendido_.** Cerrarlo no tiene efectos: los avisos se
   reconocieron al entrar.

### 9. Vista desactualizada del estudiante

Sin tiempo real, el canvas del estudiante puede quedar desactualizado. No se
agrega tratamiento especial: las acciones rechazadas muestran el error genérico
actual. El servidor ya impide completar un Nodo bloqueado, oculto o eliminado
(`completion.ts`); la descripción y los Recursos ya cargados siguen visibles en
su versión anterior, y la descarga de un archivo eliminado falla. La campana
global, visible también dentro del Roadmap, sube en vivo y sirve de señal para
volver a entrar.

Se decidió inicialmente conservar un contador de avisos propio del canvas, bajo
el título del Roadmap; se retiró el 2026-10-07 porque repetía la campana global,
visible en la misma pantalla, y su número coincidía con ella mientras se trabaja
en un solo Roadmap. El contador por curso del Resumen académico se conserva.

Se descartaron un mensaje con botón «Volver a cargar» y la recarga automática al
detectar el rechazo, para no complicar esta iteración.

### 10. Destinatarios: se avisa lo que se puede ver

| Objeto                                | Destinatarios                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| Título y tipo del Nodo                | Quien ve el Nodo: visible, accesible **o bloqueado** (cambio respecto de hoy) |
| Descripción y Recursos                | Solo quien tiene el Nodo accesible (como hoy)                                 |
| Acceso al Nodo                        | Quien cambia de estado (como hoy)                                             |
| Dependencias                          | Todos, si ambos Nodos son visibles (como hoy)                                 |
| Tipo de nodo (nombre)                 | Todos, si tiene al menos un Nodo visible (como hoy)                           |
| Creación de Nodo y Roadmap disponible | Como hoy                                                                      |

Motivo del cambio: un Nodo bloqueado expone al estudiante título y tipo, pero no
descripción ni Recursos (`completion-projection.ts`); hoy un renombre de un Nodo
bloqueado no llega a quien lo ve bloqueado. Si la descripción cambia mientras el
Nodo está bloqueado para alguien, esa persona no recibe aviso; al desbloquearse
basta el aviso de acceso, pues nunca conoció la descripción anterior.

En todos los casos se excluye a quien hizo el cambio (decisión 6).

**Avisos pendientes que dejan de ser visibles:** un aviso pendiente sobre un
objeto que su destinatario ya no puede ver (descripción o Recursos de un Nodo
que quedó bloqueado; cualquier objeto de un Nodo que quedó oculto) **no se
muestra ni se cuenta, pero no se retira**. Si el objeto vuelve a ser visible
antes del reconocimiento, el aviso reaparece. Entrar al Roadmap reconoce también
los avisos ocultos, sin mostrarlos en el dialog.

Ejemplo: Ana tiene pendiente «Se actualizó la descripción de «Colas»»; el
docente bloquea «Colas» y lo desbloquea 10 minutos después. El aviso de acceso se
retira por volver a lo conocido (3b) y el de la descripción reaparece: Ana ve
exactamente lo que cambió para ella. Se descartó **retirar** estos avisos: en ese
ejemplo Ana terminaría sin aviso alguno de una descripción que ahora puede leer.
Eliminar un Nodo sigue absorbiendo definitivamente sus avisos (decisión 1).

### 11. Pérdida de acceso al curso

Cuando la Participación de un destinatario se desactiva, **se retiran todos sus
avisos pendientes de ese Roadmap**: desaparecen del Inbox y de los contadores. Si
recupera la Participación, empieza de cero: no hay avisos que reaparezcan.

Reemplazó el comportamiento anterior, en que los avisos se conservaban y se
reconocen uno a uno al seleccionarlos («lost Course access retains saved notices
and acknowledges only the selected one»). Con el reconocimiento solo al entrar al
Roadmap, esos avisos quedarían para siempre en el Inbox. Se descartaron
conservarlos y reconocerlos al hacer clic (llevan a una página sin acceso) y
ocultarlos hasta recuperar el acceso.

### 12. Migración: empezar de cero

Al activar este modelo se **eliminan todos los avisos guardados** (individuales y
«Resumen de cambios») junto con sus registros asociados de reconocimiento y
deduplicación. No se convierten al modelo nuevo. La migración de #177 ejecutó
este reset y sustituyó la antigua indicación de no limpiar las tablas de avisos.
La operación vigente se describe en [operaciones](../notifications-operations.md).

### 13. Título y texto de las filas del Inbox

Agregado el 2026-10-07. Un aviso que solo nombraba al Nodo no decía a qué Roadmap
pertenecía el cambio.

- **Título:** toda fila del Inbox, individual o agrupada, se titula con el **nombre
  del ramo** (por ejemplo _Introducción a la Programación_). Se proyecta al leer
  desde el Curso del aviso, de modo que también corrige avisos ya guardados. El
  `subject` guardado conserva el objeto y sigue disponible en la API.
- **Texto:** describe el cambio y nombra el Nodo afectado. La fila agrupada dice
  _El Roadmap ha recibido N cambios._
- **Acceso:** describe lo que le ocurrió al Nodo según el estado conocido y el
  actual, en lugar de nombrar los estados. Vale igual para el equipo docente, que
  sigue viendo y editando un Nodo oculto:

| Conocido → actual                 | Texto                                                              |
| --------------------------------- | ------------------------------------------------------------------ |
| Disponible o Bloqueado → Retirado | «Variables» fue ocultado del Roadmap.                              |
| Retirado → Disponible             | «Variables» volvió a mostrarse en el Roadmap.                      |
| Retirado → Bloqueado              | «Variables» volvió a mostrarse en el Roadmap, pero está bloqueado. |
| Disponible → Bloqueado            | «Variables» fue bloqueado.                                         |
| Bloqueado → Disponible            | «Variables» fue desbloqueado.                                      |

El Resumen de cambios usa los mismos textos de acceso bajo el título del Nodo.
Se descartó «X pasó de Disponible a Retirado»: «Retirado» describe el estado del
estudiante y es falso para el equipo docente, que recibe el mismo aviso.

### 14. Marca de cambios por Nodo en el canvas

Agregado el 2026-10-07. La insignia por Nodo existente contaba avisos pendientes,
así que desaparecía al entrar al Roadmap, al mismo tiempo que se abría el dialog,
y nunca llegaba a verse. Se separan dos señales:

- **Campana e Inbox:** se vacían al entrar al Roadmap (decisión 4).
- **Marca del Nodo:** persiste hasta que el destinatario **abre ese Nodo**: su
  panel de edición o su detalle de estudiante. Entrar al Roadmap no la quita.

Reglas:

1. **Forma:** un círculo rojo en la esquina superior izquierda del Nodo con el
   número de cambios, sin ícono ni acción propia. La esquina superior derecha
   queda para el resumen de Recursos.
2. **Cuenta objetos:** como los demás números (decisión 7), cuenta Objetos del
   aviso distintos con cambios posteriores a la última apertura del Nodo, ya
   reconocidos o pendientes. Tres ediciones de la descripción cuentan 1.
3. **Aplica la visibilidad de la decisión 10:** no cuenta lo que el destinatario
   no puede ver, y los retiros (3b) y absorciones también la bajan.
4. **Revisión al abrir:** abrir el Nodo registra la revisión de lo que había. Un
   cambio que llega mientras el Nodo sigue abierto queda marcado hasta la
   próxima apertura: el estudiante no lo ve sin volver a entrar (decisión 5).
5. **Solo en Nodos que se pueden abrir:** el estudiante no ve la marca en un Nodo
   bloqueado; aparece cuando se desbloquea. El equipo docente la ve también en
   Nodos ocultos o con Bloqueo docente, que sí puede abrir.
6. **Pérdida de acceso:** como en la decisión 11, al recuperar la Participación la
   marca empieza de cero.

Ejemplo: el docente edita la descripción de «Pilas» y oculta «Variables». Ana
entra al Roadmap: ve el dialog y la campana queda en 0, pero «Pilas» conserva su
marca _1_ hasta que lo abre; «Variables» no tiene marca para ella porque no lo ve.
Una ayudante que entra ve la marca _1_ en ambos, porque el equipo docente sigue
viendo «Variables».

Se descartaron mantener la marca solo mientras el aviso esté pendiente (el caso
que motivó esta decisión) y volver a reconocer avisos al abrir el Nodo, que
mezclaría ambas señales y dejaría en el Inbox cambios ya leídos en el dialog.

## Alternativas descartadas

- **Objeto = Nodo completo mostrando solo el último cambio:** un cambio de
  contenido ocultaría un bloqueo u ocultación.
- **Mostrar solo el último paso** («Recursividad» → «Recursividad avanzada») a quien
  nunca conoció el valor intermedio: no informa respecto de lo que el estudiante sabía.
- **Terminar la agrupación al ver la fila del Inbox:** contradice la definición de
  aviso pendiente y genera más avisos.
- **Terminar la agrupación por plazo (p. ej. 24 h):** reintroduce el tiempo que se
  busca eliminar.
- **Entrar al Roadmap reconoce solo avisos generales; los de Nodo esperan a abrir
  el Nodo:** deja en el Inbox cambios que el estudiante ya leyó en el dialog.
- **Quitar el tiempo real del Roadmap a todos:** los docentes perderían en silencio
  ediciones concurrentes de título, descripción y tipo (la última escritura gana).
- **Actualizar en vivo el Roadmap del estudiante:** se prefirió la regla simple de
  volver a entrar para ver cambios.
- **Reconocer al abrir el Nodo los cambios llegados mientras el estudiante está
  dentro:** innecesario si el Roadmap del estudiante no cambia en vivo.
- **Reconocer automáticamente lo que llega mientras se está dentro:** daría por
  visto un cambio sutil (p. ej. una descripción) que el estudiante no notó.
- **Abrir el dialog en medio de la sesión:** diez ediciones seguidas abrirían diez
  dialogs mientras se estudia.
- **Badge de la campana que cuente lo no visto** (baja a 0 al abrir la campana) o
  **«Visto» solo como destaque visual:** se prefirió eliminar el estado.
- **Contador de avisos propio del canvas:** se retiró el 2026-10-07 por repetir la
  campana global (decisión 9).
- **Mantener agrupado el aviso general hasta la entrada aunque baje de 3:** haría
  depender el Inbox de su historial en lugar de una regla única.
- **El equipo docente no recibe avisos**, o **los reconoce solo si tenía el Roadmap
  abierto**: el primero priva de información a quien no ha entrado; el segundo
  reintroduce lógica de «estar dentro».

## Consecuencias implementadas

- Se retiraron las ventanas en memoria y el Aviso separado de resumen.
  `NoticeDeliveryEffect` conserva deduplicación por efecto; los conocimientos por
  destinatario y Objeto sostienen la reconciliación durable.
- Se retiraron el reconocimiento por apertura de Nodo, `seenAt`, la acción `seen`
  y el dialog por Aviso. El clic navega al Roadmap; la entrada reconoce y muestra
  el Resumen de cambios salvo en la primera visita.
- Los Avisos se agrupan por Objeto y el Inbox proyecta el Aviso agrupado del
  roadmap desde tres Objetos visibles. No hay esperas reales para agrupar en tests.
- Inbox y contadores siguen en vivo para todos; solo el contenido docente se
  recarga por señales ordinarias. La pérdida de acceso se verifica en todos los roles.
- La migración a cero retiró Avisos, aperturas y recibos del modelo anterior;
  no convirtió su historial. Las migraciones siguientes preservan el modelo nuevo.
- El fallback de destino no disponible queda para navegación antigua o en carrera,
  o desaparición del Curso/Roadmap. La pérdida de Participación retira los Avisos
  antes de que un Inbox actualizado ofrezca ese destino.
- (2026-10-07) El canvas ya no muestra contador de avisos. Las filas del Inbox se
  titulan con el nombre del ramo (`courseName` en la API) y el texto de acceso
  sale de `nodeAccessChangeText`; la migración reescribió los textos de acceso ya
  guardados.
- (2026-10-07) `NodeChangeReview` guarda, por destinatario y Nodo, la última
  apertura. `GET /api/notifications/node-changes` cuenta por Nodo los Objetos con
  avisos posteriores y `POST` registra la apertura. La migración dio por revisados
  los avisos ya reconocidos, para no marcar de golpe cambios del modelo anterior.

La documentación vigente está en [Avisos y Resumen de cambios](../notifications-summaries.md),
[operaciones](../notifications-operations.md) y [SSE](../notifications-sse.md).
El catálogo y la comparación de estado previo de este ADR son antecedentes de la
sesión de decisión, no una descripción del almacenamiento vigente.
