# 03 — Recibir cambios de Recursos en su Nodo propietario

Issue: [#142](https://github.com/Bigelazo/u-roadmaps/issues/142). Publicado con `ready-for-agent` y `enhancement`.

## Parent

[Especificación #139](https://github.com/Bigelazo/u-roadmaps/issues/139).

## What to build

Las Participaciones con acceso se enteran de altas, ediciones y bajas de Recursos y archivos, llegan al Nodo propietario y reconocen esos avisos al abrirlo junto con los demás avisos del Nodo.

## Acceptance criteria

- [ ] Agregar, editar o eliminar un Recurso genera su variante de Cambio de Recurso tras confirmar el cambio y solo para destinatarios elegibles de ese Nodo.
- [ ] Los archivos se expresan mediante el Recurso correspondiente; operaciones físicas sin cambio confirmado, validaciones fallidas y compensaciones no generan avisos.
- [ ] Contenido inaccesible, autora e inactivas quedan fuera de audiencia; docentes no se filtran por Completaciones.
- [ ] El mensaje conserva el título necesario después de eliminar el Recurso y abre su Nodo; no copia URL, bytes ni descripción completa a Novu.
- [ ] Los indicadores incluyen estos avisos en Nodo/Curso/Roadmap y abrir el Nodo reconoce todos sus avisos elegibles sin reconocer otros Nodos ni avisos posteriores.
- [ ] Pruebas de aceptación cubren link, video y archivo, cambios idénticos, fallos de almacenamiento/validación, Nodo bloqueado y reconocimiento conjunto con avisos de Nodo.

## Blocked by

- https://github.com/Bigelazo/u-roadmaps/issues/141
