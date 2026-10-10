# Entorno de Graphify

Consultar esta guía al preparar Graphify o cuando una actualización indique
que archivos SQL no aportaron información al grafo.

## Instalación con SQL

Las migraciones Prisma requieren el extra `sql` de `graphifyy`. La instalación
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
