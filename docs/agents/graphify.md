# Entorno de Graphify

Consultar esta guía al preparar Graphify o cuando una actualización indique
que archivos SQL no aportaron información al grafo.

## Alcance del índice

`.graphifyignore` excluye las skills instaladas, sus agentes auxiliares,
exportaciones generadas, worktrees y mediciones históricas. Mantener esas
exclusiones: las herramientas del agente no son módulos de U-Roadmaps. Los
tests, migraciones, configuración de la aplicación y documentos propios sí
pertenecen al corpus. No reducir comunidades solo para alcanzar una cifra.

## Actualización estructural y semántica

`graphify update .` actualiza la estructura sin LLM y conserva la capa
semántica. No certifica que se hayan reinterpretado los documentos modificados.
Cuando cambien reglas del dominio, usar la extracción semántica incremental de
la skill de Graphify, con prioridad en `GLOSSARY.md`, documentación vigente
y `prisma/schema.prisma`. El extractor AST instalado no clasifica
el esquema Prisma; sus modelos y relaciones necesitan extracción semántica.

En el glosario, extraer las entradas en negrita, sus definiciones y relaciones
explícitas; no limitarse a los encabezados Markdown. Registrar archivo, línea y
fundamento de las decisiones. No promover afirmaciones antiguas de README o
PRODUCT a reglas actuales sin contrastarlas con el código. Los documentos
retirados deben salir también del grafo, incluida su capa semántica.

Guardar los resultados mediante `save_semantic_cache` con el mismo
`references/extraction-spec.md` utilizado al leer la caché, y marcar únicamente
las fuentes realmente procesadas con `save_manifest(..., kind="semantic")`.
Integrar con `build_merge(..., root=...)` para mantener las rutas relativas y
reemplazar las versiones anteriores de cada fuente. Después ejecutar
`graphify update .` y comprobar que los conceptos semánticos siguen presentes.

Antes de aceptar relaciones inferidas por nombres genéricos de estado,
inicio, rol o secuencia, comprobar ámbito, importación y línea de origen.
Una coincidencia de nombre no demuestra una llamada. La etiqueta `EXTRACTED`
tampoco certifica que una afirmación histórica siga vigente.

## Validación de recuperación

Después de cambiar el corpus o regenerar su semántica, consultar permisos de
escritura, propiedad de archivos de Recursos, avisos SSE, cierre y versionado,
y seguimiento de estudiantes. Usar términos existentes en las etiquetas del
grafo y comprobar que los primeros resultados apuntan a fuentes pertinentes,
sin skills ni exports. Para conexiones concretas, contrastar las aristas con
el código; contar resultados relevantes no prueba por sí solo su exactitud.

Si una búsqueda amplia comienza en helpers de tests homónimos, usar `--seed`
con el ID de la implementación verificada. Para permisos de edición:

```sh
graphify query 'roadmap capability' \
  --seed src_features_roadmap_domain_roadmap_capability_decideroadmapcapability \
  --budget 2000
```

Las búsquedas de control restantes son `resource file ownership`,
`notification stream`, `roadmap closure version` y `student progress`.

Los informes de `docs/measurements/` documentan snapshots y quedan fuera del
índice. Las respuestas guardadas en `graphify-out/memory/` son antecedentes con
fecha, no sustituyen evidencia actual. Evitar guardar respuestas de rutina o
repetidas; conservar solo resultados duraderos con fuentes verificables.

## Instalación con SQL

Las migraciones Prisma requieren el extra SQL de `graphifyy`. La instalación
base no incluye `tree-sitter-sql`; actualizar el grafo con ella puede terminar
con salida 0 mientras omite las migraciones.

Graphify está instalado como herramienta de `uv`. El intérprete que usa este
grafo está en `graphify-out/.graphify_python`; instalar una dependencia en otro
Python no modifica esta herramienta.

Para reparar el extra conservando la versión instalada:

```sh
graphify_python="$(cat graphify-out/.graphify_python)"
graphify_version="$("$graphify_python" -c 'from importlib.metadata import version; print(version("graphifyy"))')"
uv tool install --force "graphifyy[sql]==${graphify_version}"
```

`uv` guarda el extra en el recibo de la herramienta, por lo que forma parte de
su instalación declarada. Para una instalación nueva, usar
`uv tool install 'graphifyy[sql]'`.

## Verificación y actualización

Verificar la extracción real de una migración que declara tablas:

```sh
graphify_python="$(cat graphify-out/.graphify_python)"
"$graphify_python" - <<'PY'
from pathlib import Path
from graphify.extractors.sql import extract_sql

migration = Path('prisma/migrations/20260812000000_initial/migration.sql')
result = extract_sql(migration)
assert not result.get('error'), result.get('error')
assert any(node['label'] == '"Roadmap"' for node in result['nodes'])
assert result['edges'], 'No se extrajeron relaciones SQL'
print('Extracción SQL verificada:', migration)
PY
graphify update .
```

Comprobar que `graphify-out/graph.json` contiene nodos cuyo `source_file` apunta
a las migraciones SQL. La extracción AST no aplica migraciones ni consulta
PostgreSQL. Un aviso del índice de navegación se registra por separado del
resultado de los tests de la aplicación.
