---
status: accepted
date: 2026-11-08
---

# Las confirmaciones comparten un formato único

Cada diálogo de confirmación había crecido por su cuenta: íconos arriba o ausentes, botones en varias filas, nombres de Nodos entre comillas o « », listas de Nodos afectados y verbos distintos para la misma idea. Decidimos que toda confirmación se construya con `ConfirmationDialog` y una `ConfirmationPresentation`, con estas reglas:

- **Intención.** Cada confirmación declara una de tres intenciones, que fija su ícono y el color de su acción principal:
  - `default` (neutral): la acción da acceso, muestra u ordena algo y se revierte sin pérdida, como desbloquear o programar un desbloqueo, mostrar un Nodo, cerrar sesión o salir del tutorial.
  - `warning`: la acción cambia mucho de una vez pero no destruye datos, como ordenar automáticamente, conectar Nodos que heredan un Bloqueo docente o reiniciar la previsualización.
  - `destructive`: la acción elimina o quita acceso de forma difícil de revertir, como eliminar Nodos, Dependencias, Recursos o Tipos de nodo, ocultar o bloquear un Nodo, o descartar un borrador.
- **Encabezado.** El ícono de la intención va a la izquierda y el título a su derecha; la descripción queda bajo el título.
- **Acciones.** Cancelar y hasta dos acciones van en una sola fila. Cuando dos acciones son alternativas equivalentes, ambas tienen énfasis primario.
- **Nombres.** Un Nodo o Tipo de nodo se nombra siempre con `NodeName`, con el ícono y el color de su tipo, y nunca entre comillas.
- **Descripciones.** Son breves y cuentan los elementos afectados («sus 3 prerrequisitos bloqueados») en lugar de listarlos.
- **Acceso.** Para lo que los estudiantes pueden hacer con un Nodo se dice «acceder a él», no «abrirlo».

## Consecuencias

- Los diálogos nuevos se construyen con la presentación compartida en lugar de un `AlertDialog` propio; una intención nueva o una tercera acción requieren revisar esta decisión.
- Quedan diálogos sin alinear, que deben recibir el mismo tratamiento:
  - El diálogo de elección del tutorial, «¿Cómo deseas realizar el tutorial?» (`src/shared/client/tutorial/tutorial-choice-dialog.tsx`).
  - El diálogo para crear un Roadmap (`CreateRoadmapDialog.tsx`).
  - Los diálogos «Agregar al mapa» y «Tipos de nodo» de `NodeCreator.tsx`.
  - Los Avisos del Inbox, que todavía citan nombres entre « ».
  - La confirmación para eliminar un Recurso, que muestra su nombre sin el ícono de su tipo.
