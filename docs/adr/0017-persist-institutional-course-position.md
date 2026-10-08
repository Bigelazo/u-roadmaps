---
status: accepted
date: 2026-10-07
---

# Persistir el cargo institucional de curso

`Participation` guarda solo el rol binario `TEACHER`/`STUDENT` y descarta el cargo
de U-Campus del que se derivó. La separación binaria se eligió como la forma más
simple de distinguir permisos, porque profesores coordinadores, profesores de
cátedra, profesores auxiliares y ayudantes comparten los permisos de edición. Ya
no basta: el profesor de cátedra tiene permisos adicionales (crear el Roadmap,
vacío o mediante **Roadmap copy**, y sincronizar participantes), y una versión
congelada debe mostrar a su equipo docente con el cargo de cada persona. Se decide
persistir el **Institutional course position** efectivo en cada Participation y
derivar de él los permisos, en lugar de guardar solo el rol colapsado.

## Consecuencias

- Corrige en su origen los defectos de [ADR-0016](0016-teaching-assistants-are-teaching-staff.md):
  los ayudantes pasan a ser equipo docente y los profesores coordinadores dejan de
  poder crear el Roadmap.
- Las Participations existentes necesitan completar su cargo desde U-Campus; mientras
  tanto el cargo es desconocido y no debe inferirse del rol binario.
