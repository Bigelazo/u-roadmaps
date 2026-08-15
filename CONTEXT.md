# Learning Roadmaps (Roadmaps de aprendizaje)

This context describes the learning paths of university course offerings and their participants' progress.

## Language (Lenguaje)

**U-Roadmaps (U-Roadmaps)**:
The university learning-path platform where participants navigate and manage the roadmaps of their course offerings. Its canonical product name always uses this capitalization and hyphenation; “university roadmaps” describes its subject but is not an alternative name.
_Avoid_: U-roadmaps, u-roadmaps, U Roadmaps, Roadmaps universitarios

**Course (Ramo)**:
A stable academic-catalog subject, globally identified by its code and independent of when or how often it is offered.
_Avoid_: Course offering, subject instance

**Course offering (Curso)**:
The unique instance of a course taught in a particular academic term. It groups one or more course sections that share one roadmap, and its identity and existence depend on the course it offers. After the term ends, non-withdrawn students retain read-only access through their academic history.
_Avoid_: Course, catalog subject

**Course section (Sección)**:
A coordinated subdivision of a course offering used to organize participants and assign each student to the responsible course professor. All sections share the same content, ordering, and roadmap; section membership scopes which students each course professor supervises.
_Avoid_: Course offering, roadmap

**Academic term (Período académico)**:
The calendar year and semester number that place a course offering in time.
_Avoid_: Version, season

**Academic history (Historial académico)**:
A student's private record of course offerings retained in their institutional studies. Withdrawn offerings are absent as if never enrolled. Only that student can view the complete history; teaching staff see only offerings in which they also participate.
_Avoid_: Public profile, current roster

**Academic overview (Resumen académico)**:
A student's read-only view of current and historical U-Campus courses, with current courses emphasized. Courses can appear before they have a roadmap; opening one then explains that no roadmap exists. Appearance in this view alone does not create a U-roadmaps participation.
_Avoid_: Participation, roster synchronization

**Roadmap (Roadmap)**:
The optional, unique learning path of a course offering, created at a course professor's initiative and composed of nodes and their dependencies. It is one semester's version in the course's roadmap lineage. Its creation materializes the offering, all its coordinated sections, and their rosters from U-Campus. Academic-calendar closure freezes the version; copying it with fresh identities for a new offering creates a successor, excluding participants and completions.
_Avoid_: Curriculum, course version

**Roadmap lineage (Evolución del roadmap)**:
The ordered succession of roadmap versions for the same course across academic terms. Each version can identify the version from which it was copied so their evolution can be observed.
_Avoid_: Course offering, edit history

**User (Usuario)**:
A person identified institutionally by a unique, normalized RUT who can participate in multiple course offerings. Their institutional email is unique but may be updated; conflicting identifiers must not be merged silently.
_Avoid_: Student, teacher

**Participation (Participación)**:
A user's membership in a course offering, materialized from U-Campus data, with exactly one student or teacher role. A student participation becomes inactive when a complete, successful roster snapshot reports the student's withdrawal; it then disappears from the student's records and revokes access without deleting the participation or its completions needed by teaching staff.
_Avoid_: User role, account

**Roster synchronization (Sincronización de participantes)**:
The reconciliation of a course offering's participants against a complete U-Campus roster. It occurs when the roadmap is created and when a course professor explicitly refreshes it; failed or partial attempts do not change participation activity.
_Avoid_: Authentication, additive import

**Participation role (Rol de participación)**:
The student or teaching-staff role held by a participation in one course offering. U-Campus students become students; course professors, auxiliary professors, teaching assistants, and coordinating professors become teaching staff. All teaching staff can edit the shared roadmap and view entry and completion information across all its sections. Auditors do not participate.
_Avoid_: Function, global user role

**Institutional course position (Cargo institucional de curso)**:
The effective U-Campus position a participant holds in a course offering. When teaching positions differ across sections, the highest applies throughout the offering: teaching assistant, then auxiliary professor, then course professor. A coordinating professor remains a teaching participant who can edit but does not create or synchronize the roadmap. The position is retained alongside the simplified participation role.
_Avoid_: Participation role, global permission

**U-Campus (U-Campus)**:
The institutional academic record and source of courses, course offerings, participants, and their academic roles. U-roadmaps materializes the data it needs locally.
_Avoid_: Local database, identity provider

**VTI (VTI)**:
The institutional identity provider that authenticates a person. It does not determine their participation or role in a course offering.
_Avoid_: U-Campus, academic record, authorization source

**Platform entry (Ingreso a la plataforma)**:
The fact that a participant completed a successful VTI login after joining a course offering's roster. Roster import alone is not an entry; the latest entry time may be retained.
_Avoid_: Roster import, node completion, roadmap visit

**Node (Nodo)**:
An element of a roadmap that holds pedagogical information, has exactly one node type, and can be visible or hidden from students. A hidden node is absent from a student's roadmap and cannot be completed by that student. Confirmed deletion also removes its dependencies, resources, and completions.
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
The dated fact that a participating student completed a node in their course offering's roadmap. Only current visible prerequisites must be complete; a student cannot reverse it, and repeated completion attempts preserve the original fact and date. Later roadmap changes do not invalidate it, though it disappears if a teacher deletes the node. Its absence means the node is pending.
_Avoid_: Progress state, mutable progress

**Resource (Recurso)**:
A URL reference with a title and file, link, or video type to pedagogical material stored outside the database and attached to one node.
_Avoid_: File, global material
