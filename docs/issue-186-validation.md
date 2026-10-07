# Validación de #186 — 2026-10-07

Base: `30f53507fcd08119fe0a89564e319431f27edaa3`.

La documentación de Avisos, operaciones y SSE describe el modelo implementado
por Objeto del aviso, absorción, visibilidad, reconocimiento al entrar y Aviso
agrupado del roadmap. ADR-0014 registra las consecuencias implementadas y la
migración a cero. El fallback queda para destinos antiguos o navegación en carrera,
con una razón explícita; no necesita recibir la identidad del Aviso.

El spec de ventanas ya había sido convertido a un recorrido activo sin omisiones.
Se retiró su nombre `own-notification-summaries.spec.ts` y se conservó la cobertura
como `own-notice-absorption.spec.ts`. La auditoría de tests no encontró esperas de
tiempo real para agrupar Avisos. Los timers de SSE y la espera de layout tienen
otros propósitos.

## Resultados

- `pnpm typecheck`: aprobado, dos ejecuciones.
- `pnpm test:unit`: 67 archivos y 345 pruebas aprobadas, 30,54 s, salida 0.
- E2E focalizado: 8 pruebas aprobadas, 26,6 s, salida 0.
- `pnpm test:e2e`: 110 pruebas aprobadas, sin fallos ni omisiones, 1,1 min, salida 0.
  PostgreSQL local existente y Chromium, dos workers, según la configuración actual.
  No se ejecutó Firefox.
- ESLint y Prettier de los archivos de código modificados: aprobados.
  Prettier de los documentos modificados y `git diff --check`: aprobados.
- `NEXT_DIST_DIR=.next-e2e pnpm check:notification-bundle`: 596 artefactos revisados,
  sin SDK ni configuración retirada, salida 0.
- `graphify update .`: actualización AST completada (2751 nodos, 6054 aristas).
  El extractor advirtió que 32 archivos SQL no aportaron al grafo porque falta
  `tree_sitter_sql`. No se realizó extracción semántica de documentos.

Se ejecutó code-review una sola vez, con los ejes Standards y Spec en paralelo.
Standards: cero hallazgos. Spec: un hallazgo, aplicado: documentar que la interfaz
no ofrece banner ni botón de reintento del reconocimiento fallido, distinguiéndolo
del contrato HTTP idempotente.

Las pruebas validan el árbol de trabajo existente, que incluía cambios previos del
usuario en el canvas, configuración de Playwright y tests. Esos cambios se
preservaron y se excluyeron del commit y de la revisión de #186.
