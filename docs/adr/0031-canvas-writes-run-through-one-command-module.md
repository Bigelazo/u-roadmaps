---
status: accepted
date: 2026-10-17
---

# Las escrituras del canvas pasan por un único módulo de comandos con una sola Acción confirmada pendiente

Cada **Acción confirmada** del canvas (ocultar o mostrar un Nodo, eliminarlo, cambiar un
Bloqueo docente, crear o eliminar Dependencias, aplicar el ordenamiento automático,
eliminar un Tipo de nodo, reiniciar la Canvas preview) tenía su propio hook con su propio
estado, y la vista del canvas las coordinaba con un lock de exclusividad, un mapa de
ocupación y un `switch` de diálogos. Solo la eliminación de Nodos y el Bloqueo docente
volvían a calcular su **Impacto del cambio** al confirmar, cada uno con su propia función
de igualdad. Se decide que las escrituras del canvas pasen por un módulo de comandos
(`canvas/commands/`) detrás de la **Sesión del canvas del roadmap**.

## Decisiones

- **Una sola Acción confirmada pendiente, por construcción.** El módulo tiene un único
  espacio pendiente: mientras una Acción confirmada se previsualiza, espera una elección
  o se confirma, ninguna otra puede abrirse. La exclusividad no depende de que la vista
  coordine nada.
- **Cada Acción confirmada es una declaración simple:** una previsualización opcional de
  su Impacto del cambio, si ese impacto necesita confirmación (una Dependencia que no
  bloquea ningún Nodo se crea sin preguntar), su escritura y su mensaje de éxito. La
  escritura puede dejar pendiente solo la parte que falló (al eliminar varias
  Dependencias). Un solo motor (un hook de React) las ejecuta. No hay registro de plugins
  ni middleware.
- **El módulo devuelve la confirmación pendiente como datos** (tipo, solicitud, impacto,
  fase y elección). Un único mapeador en la UI de confirmaciones del Roadmap la convierte
  en el diálogo. Los identificadores de las elecciones viven en el vocabulario del
  módulo, sin JSX.
- **Revalidación uniforme del Impacto del cambio.** Al confirmar, toda acción con
  previsualización la vuelve a pedir y compara el JSON del impacto (el orden del servidor
  es determinista). Si cambió, se muestra el nuevo impacto en vez de aplicar el cambio.
  Si no cambió, se escribe enviando la versión de la previsualización. Si la escritura
  falla, se previsualiza otra vez y se muestra el último impacto. Esto suma una petición
  al confirmar una ocultación o una Dependencia con impacto, y dos al desbloquear (se
  vuelven a pedir ambos alcances), y es independiente de que el servidor verifique
  versiones.
- **La pregunta por el borrador sin guardar se hace una sola vez,** en el módulo, antes
  de ocupar el espacio pendiente, venga la eliminación del menú de acciones del Nodo o
  del editor de Nodos. Así el canvas nunca queda bloqueado detrás de una pregunta sin
  responder.

La migración es incremental: mientras una Acción confirmada no se mueve al módulo, la
vista conserva su lock para ella, y el lock y el espacio pendiente se respetan
mutuamente.

## Alternativas descartadas

- **Hooks por flujo coordinados por la vista:** es el diseño anterior; cada hook tenía su
  propio estado de ocupación y la vista necesitaba el lock, el mapa y el `switch` para
  impedir dos diálogos a la vez.
- **Un motor de plugins** con fases y middleware por acción: demasiada abstracción para
  una decena de acciones; las diferencias (pares de previsualizaciones del Bloqueo
  docente, reintento parcial de Dependencias) caben en la declaración.
- **Verificar el impacto obsoleto solo en el servidor:** deja sin protección los cambios
  cuya versión el servidor no verifica, y el usuario vería un error en vez del impacto
  nuevo.
- **Una suite de contrato entre adapters:** [ADR-0028](0028-roadmap-editing-rules-are-shared-domain-decisions.md)
  ya la descartó; el módulo se prueba en proceso contra el adapter del **Mapa de
  práctica**, que comparte las decisiones de dominio con el servidor.

La corrección de [ADR-0015](0015-teacher-edit-concurrency-relies-on-realtime.md) (qué
cambios protege hoy la versión de la previsualización) pertenece al módulo de comandos
del Roadmap en el servidor ([ADR-0029](0029-roadmap-writes-run-through-one-command-module.md)).
