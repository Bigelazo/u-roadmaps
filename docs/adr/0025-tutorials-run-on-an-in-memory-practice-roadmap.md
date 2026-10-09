---
status: accepted
date: 2026-10-09
---

# Los tutoriales corren sobre un Practice roadmap en memoria

Ambos **Roadmap tutorials** (estudiante y equipo docente), construidos con driver.js,
corren en una ruta propia sobre el **Practice roadmap**: un mapa fijo servido por la
persistencia en memoria del canvas, que reutiliza el mismo `RoadmapCanvasSession` que
un Roadmap real. Así cada tutorial muestra siempre todos los casos (Estados del nodo,
dependencias múltiples, Teacher block con Scheduled unlock, nodo oculto), el equipo
docente ejecuta acciones reales sin consecuencias y cada apertura parte del mismo
estado inicial. Lo único persistido en la base de datos es que el Usuario ya recibió
cada invitación.

## Opciones consideradas

- **Sembrar Nodos de ejemplo al crear un Roadmap**: descartada. Los estudiantes los
  verían, generarían Roadmap notices, chocarían con la Roadmap copy y el tutorial se
  rompería en cuanto el equipo docente modificara la base.
- **Persistir un Roadmap de tutorial**: descartada. Un Roadmap es el camino único de un
  Course offering; uno sin Curso, Participations ni Academic term rompe el modelo y
  acumula estado entre intentos.
- **Recorrer el Roadmap real del estudiante**: descartada. Al inicio del semestre suele
  estar vacío o completamente bloqueado (toda Roadmap copy parte con Teacher block), y
  un nodo bloqueado ni siquiera puede abrirse.
