---
status: proposed
date: 2026-10-08
---

# La creación de un nodo acepta descripción en Markdown

El diálogo "Agregar al mapa" (`src/features/roadmap/editor/NodeCreator.tsx`) solo
pide título, tipo y visibilidad; la descripción y el arrastre de un archivo `.md`
existen únicamente en el panel de edición (`MarkdownEditor`). Se agregará el campo
de descripción, reutilizando `MarkdownEditor` con su arrastre de `.md`, al crear un
nodo, y el tutorial docente lo mostrará en ese paso.
