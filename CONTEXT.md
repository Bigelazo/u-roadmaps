# Learning Roadmaps (Roadmaps de aprendizaje)

This context describes the learning paths of university course offerings and their participants' progress.

## Language (Lenguaje)

**Course (Ramo)**:
A stable academic-catalog subject, globally identified by its code and independent of when or how often it is offered.
_Avoid_: Course offering, subject instance

**Course offering (Curso)**:
The unique instance of a course taught in a particular academic term. Its identity and existence depend on the course it offers.
_Avoid_: Course, catalog subject

**Academic term (Período académico)**:
The calendar year and semester number that place a course offering in time.
_Avoid_: Version, season

**Roadmap (Roadmap)**:
The optional, unique learning path of a course offering, composed of nodes and their dependencies. It can be empty or copied with fresh identities, excluding participants and completions.
_Avoid_: Curriculum, course version

**User (Usuario)**:
A person identified internally by a unique, immutable institutional email address who can participate in multiple course offerings.
_Avoid_: Student, teacher

**Participation (Participación)**:
A user's historical membership in a course offering, materialized at first access, with exactly one student or teacher role and an active state determined by U-Cursos. Losing active status revokes access without deleting completions.
_Avoid_: User role, account

**Participation role (Rol de participación)**:
The student or teacher role held by a participation in one course offering.
_Avoid_: Function, global user role

**U-Cursos (U-Cursos)**:
The institutional source of courses, course offerings, and their participants. U-roadmaps materializes that data locally when a teacher creates or copies a roadmap.
_Avoid_: Local database, roadmap administrator

**Node (Nodo)**:
An element of a roadmap that holds pedagogical information, has exactly one node type, and can be visible or hidden from students. Confirmed deletion also removes its dependencies, resources, and completions.
_Avoid_: Learning unit

**Node type (Tipo de nodo)**:
A named, hexadecimal-color category that expresses the kind of pedagogical information represented by a node, such as learning content or an assessment. It can be predefined or customized for a roadmap.
_Avoid_: Visual type, style

**Predefined node type (Tipo de nodo predefinido)**:
An immutable node type offered by the platform as a shared base for every roadmap. The initial set includes Content, Assessment, and Supplementary material.
_Avoid_: Custom node type, editable template

**Custom node type (Tipo de nodo personalizado)**:
A node type defined and editable within a roadmap; it is copied when that roadmap originates one for another course offering.
_Avoid_: Global node type, teacher node type

**Supplementary material (Material extra)**:
A possible node type for content that supports study beyond the core subject matter.
_Avoid_: Enrichment layer, visibility

**Dependency (Dependencia)**:
A unique, directed relationship between distinct nodes in the same roadmap where the source node is a pedagogical prerequisite of the target node. Dependencies cannot form cycles.
_Avoid_: Link, visual connection

**Completion (Completación)**:
The dated fact that a participating student completed a node in their course offering's roadmap. Only current visible prerequisites must be complete; a student cannot reverse it, and later roadmap changes do not invalidate it, though it disappears if a teacher deletes the node. Its absence means the node is pending.
_Avoid_: Progress state, mutable progress

**Resource (Recurso)**:
A URL reference with a title and file, link, or video type to pedagogical material stored outside the database and attached to one node.
_Avoid_: File, global material
