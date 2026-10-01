# 02 — Recibir y reconocer cambios de Nodos accesibles

Issue: [#141](https://github.com/Bigelazo/u-roadmaps/issues/141). Publicado con `ready-for-agent` y `enhancement`.

## Parent

[Especificación #139](https://github.com/Bigelazo/u-roadmaps/issues/139).

## What to build

Una Participación elegible descubre un Nodo visible recién creado y reconoce sus actualizaciones al abrirlo. Los indicadores de Curso, Roadmap y Nodo muestran cantidades consistentes y mantienen pendientes los Nodos aún no abiertos.

## Acceptance criteria

- [ ] La creación visible emite Nodo disponible; editar título, descripción o Tipo asignado emite Nodo actualizado solo ante un cambio efectivo. Crear oculto, mover el canvas, editar valores idénticos o cancelar una previsualización no emite.
- [ ] La audiencia excluye autora, inactivas y otros Cursos. Estudiantes y observadores usan acceso individual; docentes usan visibilidad y ausencia de Bloqueo docente sin consultar Completaciones.
- [ ] Campana, Resumen académico, Roadmap y cada Nodo muestran conteos no leídos filtrados por identidades estables; el indicador de Nodo se distingue del Estado del nodo.
- [ ] Cada indicador abre Inbox con su filtro. Mostrar filas concretas marca visto sin bajar conteos; filas fuera de pantalla/no cargadas no se marcan.
- [ ] Seleccionar un aviso navega al Roadmap y abre allí su diálogo. Abrir un Nodo accesible desde el canvas o desde ese diálogo reconoce todos sus avisos elegibles, recorriendo la paginación; abrir/cerrar el diálogo solo no reconoce.
- [ ] Entrar al Roadmap mantiene pendientes Nodos accesibles no abiertos. Cada apertura fija IDs elegibles sin usar readAll/seenAll y evita que rerenders, refetch o avisos posteriores extiendan el reconocimiento.
- [ ] Un aviso llegado con el Nodo o Roadmap ya abierto permanece pendiente hasta una nueva apertura. Un fallo de reconocimiento conserva estado pendiente y reintenta los mismos IDs sin incluir avisos nuevos.
- [ ] El diálogo mantiene contenido seguro, autor, títulos y fecha efectiva; el deep link revalida permisos/existencia y nunca interpreta el payload como autorización.
- [ ] Pruebas de aceptación cubren dos Cursos, varios Nodos, docentes, tratamiento estudiantil del observador, apertura directa, paginación, llegada concurrente y privacidad de contenido bloqueado.

## Blocked by

- https://github.com/Bigelazo/u-roadmaps/issues/140
