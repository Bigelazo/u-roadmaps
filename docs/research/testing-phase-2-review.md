# Revisión de etapa 2: composición UI

Investigado el 2026-11-05. Inspección del checkout vigente, consulta Graphify y documentación primaria; no se ejecutaron suites, navegador, mutaciones ni pruebas de compatibilidad de `next/dynamic`. Los rangos LOC son estimaciones de implementación, no un diff medido. No se modificó producto ni configuración.

## Dictamen

Conservar el objetivo y reducir la matriz: fortalecer el reinicio existente y añadir dos recorridos de composición (edición consecutiva y fallo/reintento). La carrera de respuesta antigua es una ampliación condicionada a demostrar un hueco específico. No copiar la matriz de ciclo de vida del editor a la sesión.

## Evidencia y decisiones

| Decisión | Evidencia inspeccionada | Consecuencia |
| --- | --- | --- |
| Mantener la regresión parametrizada de reinicio | `tests/features/roadmap/session/canvas-preview-reset.test.tsx:140` ya prueba dependiente completado y sin completar; `:185` comprueba bloqueo y ausencia de `resources` en la proyección | Extender el mismo archivo; conservar ambas variantes porque el estado previo difiere. |
| Cambiar sus hijos sustituidos | `canvas-preview-reset.test.tsx:16` reemplaza cualquier import dinámico por el editor fijo y `:59` sustituye el detalle por un botón | El editor es real, pero no el mecanismo de carga ni el detalle. El test actual no demuestra que la vista estudiantil o sus paneles oculten descripción/enlaces. |
| Usar contenido discriminante | `canvas-preview-reset.test.tsx:109` tiene descripción, pero `:115` recursos vacíos; `:192` espera `Recursos (0)` al regresar | Añadir un enlace y descripción exclusivos del dependiente; observarlos antes del reinicio y recuperarlos al volver al editor. Ausencia posterior sin presencia anterior podría pasar por un render siempre vacío. |
| Mantener coordinación aislada | `RoadmapCanvasSession.test.tsx:18` anula el editor; `:162` cubre cambio de Curso con carga tardía; `:303` refetch fuera de orden; `:386` aislamiento del progreso | No convertir esos casos en montajes de todos los paneles. No eliminar la prueba de preview completa solo por compartir acciones: conserva el aislamiento de persistencia docente/estudiantil. |
| Mantener editor bajo Strict Mode | `NodeEditor.test.tsx:136`, `:777`, `:816`, `:837`, `:851`, `:868` | Ya cubre secuencia de títulos/enlaces/archivo, Activity éxito/rechazo, reemplazo de Nodo, desmontaje y reintento. La ganancia nueva debe ser actualización canónica y persistencia reales, no repetir callbacks. |
| Mantener detalle aislado | `tests/features/roadmap/student/NodeDetail.test.tsx:122`, `:140`, `:147` prueban recursos/completar/bloqueo | La composición aporta la transición entre esos estados; no repetir aquí todos los controles y tamaños. |

El recorrido exacto que falta es provider → `RoadmapCanvasSession` → `RoadmapCanvasView` → comandos/sesión → persistencia en memoria → proyección refrescada → panel/editor/detalle reales. La unión editor/comandos convierte resultados a `committed`/`rejected` en `src/features/roadmap/session/RoadmapCanvasView.tsx:225`; la sesión captura rechazos y refresca después de ejecutar en `src/features/roadmap/session/session.tsx:310`. Un `perform` resuelto directamente en el test del editor omite estas dos conversiones.

En `RoadmapCanvasView.tsx:671` el editor solo existe en modo edición; el detalle se monta por otra rama en `:722`. El bloqueo también condiciona la apertura del panel en `:618`. Por tanto, reiniciar puede cerrar el detalle por diseño: aceptar panel cerrado o contenido bloqueado según el contrato vigente, exigir siempre ausencia de la descripción/enlace exclusivos y del editor docente. No exigir un mensaje de bloqueo en un panel que debe cerrarse. `src/features/roadmap/student/NodeDetail.tsx:148` excluye el cuerpo bloqueado y `:123` usa el botón real `Completar`, no `Completar Derivadas`; actualizar locators y usar `within` en el diálogo/panel activo.

## Alcance mínimo aceptable

1. **Reinicio (dos variantes existentes):** montar con `reactStrictMode: true`, completar prerrequisito mediante el detalle real, seleccionar dependiente, comprobar descripción/enlace, reiniciar con diálogo real, comprobar ausencia de datos docentes y proyección bloqueada sin propiedades sensibles; volver al editor y comprobar contenido original íntegro. Conservar selector de grafo con callbacks/slots tipados.
2. **Secuencia de persistencia:** dos títulos y dos enlaces por controles reales en una misma sesión montada. Esperar cada actualización canónica, comprobar títulos/enlaces visibles y snapshots por `persistence.load()`, además de poder empezar otra edición. Eliminar upload de este caso: ya está en `NodeEditor.test.tsx:803` y no hace falta simular almacenamiento aquí.
3. **Fallo/reintento:** decorar una ejecución de guardado, rechazar antes de delegar; comprobar toast, borrador conservado, control habilitado y persistencia intacta. Reintentar delegando realmente, comprobar contenido persistido y siguiente acción habilitada. No devolver directamente `committed` desde un doble del editor.

Una cuarta carrera solo se añade con una secuencia alcanzable por UI y una aserción que los casos existentes no cubran. Cambio de Nodo tiene guardas de borrador; no forzar props internas para esquivarlas. Cambio de Curso es más claro: `src/features/roadmap/session/RoadmapCanvasSession.tsx:10` cambia la key y desmonta la vista. Ya hay cobertura separada de carga tardía y editor desmontado; la composición solo añade valor si prueba la ejecución pendiente, su refresh y que el nuevo borrador sigue íntegro. Debe usar dos persistencias propias para que el guardado del Curso anterior no mute accidentalmente la fixture nueva. Posponer por defecto.

## Carga dinámica y asincronía

Probar primero `next/dynamic` real, con `findBy` para esperar editor. No hay evidencia ejecutada de incompatibilidad actual. El import nombrado con `{ ssr: false }` está en `RoadmapCanvasView.tsx:74`; la guía instalada `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md:157` documenta ese patrón. Si jsdom exige una adaptación, envolver **el loader recibido** con lazy/Suspense y conservar refs/props; no devolver un editor fijo para cualquier loader. No atribuir a esa adaptación garantías del chunk o de Next en navegador.

El decorador debe preservar `execute(command, previewVersion)` y su resultado (`src/features/roadmap/session/in-memory-persistence.ts:213`). Retrasar solo el comando escogido, señalar recepción antes de liberar/rechazar y delegar después de liberar; las lecturas y `readChangeImpact` permanecen reales. No retrasar todos los comandos ni mezclar fallo previo a mutación con fallo de refresh posterior. Guardar cada operación pendiente y liquidarla en `finally`, esperar su terminación y desmontar; restaurar spies y globals por caso. RTL limpia DOM automáticamente por la configuración vigente (`vitest.config.mts:38`), pero eso no liquida promesas ni restaura globals. El archivo actual usa `afterAll` para globals (`canvas-preview-reset.test.tsx:14`); cambiar a limpieza por test.

`userEvent.setup()` por caso, acciones esperadas, sin acciones dentro de `waitFor`; usar `act` para resolver señales externas cuando corresponda. Strict Mode se habilita en el root del montaje y se verifican resultados de acciones, no cantidades transitorias de efectos. Activity se queda en el editor: sus tests actuales desconectan efectos, conservan input y liquidan éxito/rechazo; agregarla al producto o multiplicar toda la matriz no aporta una garantía nueva.

## Balance LOC estimado

| Alcance | Producción + / − | Tests + / − | Configuración + / − | Neto |
| --- | --- | --- | --- | --- |
| Mínimo recomendado: extender archivo de 195 líneas, dos recorridos nuevos y decorador local | 0 / 0 | 150–240 / 35–65 | 0 / 0 | +85–205 |
| Carrera adicional, solo si se justifica el hueco | 0 / 0 | 45–80 / 0 | 0 / 0 | +45–80 |

Incluye fixture discriminante, retirada del detalle falso y reemplazo/eliminación del mock dinámico. El rango alto contempla adaptación del loader y limpieza robusta; si `next/dynamic` funciona, usar el bajo. No presupone borrar casos útiles de `RoadmapCanvasSession.test.tsx` o `NodeEditor.test.tsx`, ni extraer un harness compartido. Una implementación de más de unas 300 líneas netas en esta etapa debe explicar qué garantía adicional aporta. No es un límite automático ni una métrica de calidad. Documentación de esta revisión se contabiliza aparte.

## Fuentes primarias y límites

- [React StrictMode](https://react.dev/reference/react/StrictMode): comprobaciones de render/efectos/refs solo en desarrollo. Fundamenta el montaje explícito; no prueba que este checkout pase.
- [React Activity](https://react.dev/reference/react/Activity): ocultar limpia efectos y conserva estado. Fundamenta distinguir ocultación y desmontaje.
- [React Testing Library API](https://testing-library.com/docs/react-testing-library/api/): opción `reactStrictMode`, `cleanup` y `act`; permite el alcance local.
- [user-event introducción](https://testing-library.com/docs/user-event/intro/): secuencia de interacciones y verificaciones de interactuabilidad; recomienda instancias setup y acciones esperadas.
- Guía Next instalada de lazy loading citada arriba: fuente primaria de la versión disponible; su descripción de carga no acredita funcionamiento de Vitest ni transformación real de chunks.

Aceptación ejecutable pendiente: casos afectados en worktree/locks según guía del repo; registrar duración y fallo observado de la mutación de reinicio o descarte de resultado antes de declarar sensibilidad. Esta revisión valida el diseño propuesto por inspección, no aprueba la suite.
