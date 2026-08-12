# Roadmaps de aprendizaje

Este contexto describe las rutas de aprendizaje de asignaturas universitarias y el avance de sus participantes.

## Language

**Ramo**:
Una asignatura estable del catálogo académico, identificada globalmente por su código e independiente de cuándo o cuántas veces se imparta.
_Avoid_: Curso, asignatura impartida

**Curso**:
La única impartición de un ramo durante un período académico determinado. Su identidad y existencia dependen del ramo impartido.
_Avoid_: Ramo, asignatura del catálogo

**Período académico**:
El par formado por un año calendario y un número de semestre que ubica temporalmente un curso.
_Avoid_: Versión, temporada

**Roadmap**:
La ruta de aprendizaje opcional y única de un curso, formada por nodos y sus dependencias. Puede crearse vacía o copiando la estructura y los recursos de otro roadmap con identidades nuevas, nunca sus participantes ni completaciones.
_Avoid_: Malla curricular, versión del curso

**Usuario**:
Una persona identificada internamente en la plataforma mediante un correo institucional único e inmutable, que puede participar en distintos cursos.
_Avoid_: Estudiante, docente

**Participación**:
La pertenencia histórica de un usuario a un curso, materializada en su primer acceso, junto con su única función de estudiante o docente y su vigencia según U-Cursos. Perder vigencia revoca el acceso sin eliminar completaciones.
_Avoid_: Rol de usuario, cuenta

**U-Cursos**:
La fuente institucional de ramos, cursos y sus participantes. U-roadmaps materializa localmente esos datos cuando un docente crea o copia un roadmap.
_Avoid_: Base local, administrador de roadmaps

**Nodo**:
Un elemento de un roadmap que almacena información pedagógica, posee exactamente un tipo y puede estar visible u oculto para estudiantes. Su eliminación confirmada también elimina sus dependencias, recursos y completaciones.
_Avoid_: Unidad de aprendizaje

**Tipo de nodo**:
La categoría con nombre y color hexadecimal que expresa qué clase de información pedagógica representa un nodo, como una unidad de aprendizaje o una evaluación. Puede ser un tipo predefinido o uno personalizado para un roadmap.
_Avoid_: Tipo visual, estilo

**Tipo predefinido**:
Un tipo de nodo inmutable ofrecido por la plataforma como base común para todos los roadmaps. El conjunto inicial incluye Contenido, Evaluación y Material extra.
_Avoid_: Tipo personalizado, plantilla editable

**Tipo personalizado**:
Un tipo de nodo definido y editable dentro de un roadmap; se copia cuando ese roadmap origina el de otro curso.
_Avoid_: Tipo global, tipo del docente

**Material extra**:
Un posible tipo de nodo para contenido que permite profundizar más allá de la materia principal.
_Avoid_: Capa de profundización, visibilidad

**Dependencia**:
Una relación dirigida y única entre dos nodos distintos del mismo roadmap en la que el nodo de origen es prerrequisito pedagógico del nodo de destino. Las dependencias no pueden formar ciclos.
_Avoid_: Enlace, conexión visual

**Completación**:
El hecho fechado de que un estudiante participante completó un nodo del roadmap de su curso. Solo los prerrequisitos visibles vigentes deben estar completos; el estudiante no puede revertirlo y los cambios posteriores al roadmap no lo invalidan, aunque desaparece si el docente elimina el nodo. Su ausencia significa que el nodo está pendiente.
_Avoid_: Estado de progreso, progreso mutable

**Recurso**:
Una referencia obligatoria mediante URL, con título y tipo de archivo, enlace o video, a material pedagógico almacenado fuera de la base de datos y vinculada a un único nodo.
_Avoid_: Archivo, material global
