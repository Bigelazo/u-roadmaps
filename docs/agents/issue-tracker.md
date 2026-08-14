# Gestor de issues: GitHub

Los issues y PRD de este repositorio viven como issues de GitHub. Usa la CLI `gh` para todas las operaciones.

## Convenciones

- **Crear un issue**: `gh issue create --title "..." --body "..."`. Usa un heredoc para cuerpos de varias líneas.
- **Leer un issue**: `gh issue view <number> --comments`, filtrando comentarios con `jq` y obteniendo también las etiquetas.
- **Listar issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` con los filtros `--label` y `--state` apropiados.
- **Comentar un issue**: `gh issue comment <number> --body "..."`.
- **Aplicar o quitar etiquetas**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
- **Cerrar**: `gh issue close <number> --comment "..."`.

Infiere el repositorio desde `git remote -v`; `gh` lo hace automáticamente dentro de un clon.

## Pull requests como superficie de triage

**PR como superficie de solicitudes: no.** _(Cambia a `yes` si este repositorio trata PR externos como solicitudes de funcionalidades; `/triage` lee este indicador.)_

Cuando está en `yes`, los PR siguen las mismas etiquetas y estados que los issues mediante los equivalentes `gh pr`:

- **Leer un PR**: `gh pr view <number> --comments` y `gh pr diff <number>`.
- **Listar PR externos para triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`; conserva solo `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR` o `NONE` en `authorAssociation`.
- **Comentar, etiquetar o cerrar**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub comparte el espacio numérico entre issues y PR, por lo que un `#42` puede ser cualquiera de ambos. Resuélvelo con `gh pr view 42` y, si falla, usa `gh issue view 42`.

## Cuando una skill dice "publicar en el gestor de issues"

Crea un issue de GitHub.

## Cuando una skill dice "obtener el ticket relevante"

Ejecuta `gh issue view <number> --comments`.

## Operaciones de wayfinding

Usado por `/wayfinder`. El **mapa** es un único issue con issues **hijos** como tickets.

- **Mapa**: un issue con la etiqueta `wayfinder:map`, que contiene Notas, Decisiones hasta ahora y Niebla. Usa `gh issue create --label wayfinder:map`.
- **Ticket hijo**: un issue enlazado al mapa como sub-issue de GitHub (`gh api` sobre el endpoint de sub-issues). Si los sub-issues no están habilitados, agrega el hijo a una lista de tareas del mapa y escribe `Part of #<map>` al inicio de su cuerpo. Etiquetas: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Una vez asignado, el ticket se asigna al desarrollador a cargo.
- **Bloqueo**: las **dependencias nativas de issues** de GitHub son la representación canónica visible en la UI. Agrega una arista con `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, donde `<blocker-db-id>` es el identificador numérico de base de datos del bloqueador (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, no el `#number` ni `node_id`). GitHub informa `issue_dependencies_summary.blocked_by` solo para bloqueadores abiertos. Si no hay dependencias disponibles, usa una línea `Blocked by: #<n>, #<n>` al inicio del cuerpo del hijo. Un ticket se desbloquea cuando todos sus bloqueadores se cierran.
- **Consulta de frontera**: lista los hijos abiertos del mapa, descarta los que tengan un bloqueador abierto o una persona asignada, y toma el primero en el orden del mapa.
- **Asignar**: `gh issue edit <n> --add-assignee @me`, como primera escritura de la sesión.
- **Resolver**: `gh issue comment <n> --body "<answer>"`, luego `gh issue close <n>` y finalmente agrega un puntero de contexto a las Decisiones hasta ahora del mapa.
