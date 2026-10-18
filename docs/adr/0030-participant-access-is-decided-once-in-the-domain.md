---
status: accepted
date: 2026-10-17
---

# El acceso de cada participante se decide una vez en el dominio; el SQL del Inbox lo recibe como dato

La regla que decide a qué Nodos accede un participante y qué muestra un **Blocked node**
existía varias veces: tres copias de la regla del equipo docente, dos proyecciones del
Blocked node (servidor y **Practice roadmap**), un CTE recursivo en el SQL del Inbox y la
visibilidad de avisos ([ADR-0014](0014-target-based-notice-grouping.md), decisión 10)
escrita en TypeScript y en SQL, ambas sobre los campos heredados `changeKind` y
`changedFields`. Una ruta que se saltó la regla expuso a estudiantes la descripción y los
**Resources** de Nodos bloqueados. Se decide que la regla viva una sola vez y que el SQL
reciba su resultado.

## Decisiones

1. **Una vista pura de dominio decide el acceso por participante** y qué expone un
   Blocked node (`domain/participant-view.ts`): el título y el **Node type** sí; la
   descripción, los Resources y la completación no. La usan las lecturas del servidor
   (Roadmap del estudiante, **Canvas preview**, Completion y Resources), la instantánea de
   acceso, notifications y el Practice roadmap. El equipo docente, como destinatario de
   avisos, tiene su propia rama explícita: Nodos visibles sin **Teacher block**. Esa rama
   decide su Acceso al Nodo; en los demás avisos de un Nodo, la visibilidad y el Bloqueo
   docente no lo limitan (decisión 3).
2. **El SQL del Inbox conserva agrupar antes de paginar, contar y las Node change marks,
   pero recibe los ids de los Nodos accesibles** del destinatario y nunca reimplementa la
   regla de bloqueo.
3. **Cada Notice target declara a quién se muestran sus avisos** (`shownTo`): `everyone`,
   `node-viewers`, `node-openers`, `dependency-viewers` o `node-type-viewers`. El
   evaluador en TypeScript (Change summary y lectura de un aviso) y el `CASE` del Inbox,
   que compara `noticeTarget` con arreglos por clase construidos desde los descriptores,
   leen esa declaración. Una fila que ningún descriptor posee nunca se muestra: desde #272
   una migración borró esas filas y los campos heredados `changeKind`, `changedFields` y
   `targetKind`, de modo que todo aviso guardado pertenece a un Notice target.

   La declaración se evalúa con un único dato más del destinatario: su Rol de
   participación. Para el equipo docente (`TEACHER`), todo Nodo existente es visible y se
   puede abrir en `node-viewers`, `node-openers` y `dependency-viewers`
   ([ADR-0014](0014-target-based-notice-grouping.md), decisión 10, «Equipo docente»);
   `everyone` y `node-type-viewers` no cambian, y cualquier otro rol recibe la regla del
   estudiante. La
   regla vive en `seesEveryNode`: el evaluador en TypeScript la recibe con el rol, y el
   `CASE` del Inbox lee el rol de la Participación que ya une. El test de paridad del Inbox
   compara ambos para estudiantes y equipo docente. Las audiencias y los Valores conocidos
   aplican la misma regla mediante los helpers compartidos de los descriptores, que leen
   el rol desde la vista del Roadmap.

## Alternativas descartadas

- **Mantener el CTE en SQL protegido por un test de paridad:** deja la regla más
  importante del producto en dos lenguajes, que deben cambiar a la vez.
- **Llevar el Inbox completo a TypeScript:** las Node change marks recorren avisos
  reconocidos, un conjunto que crece sin límite, y el agrupamiento debe ocurrir antes de
  paginar; habría que cargar backlogs completos.
