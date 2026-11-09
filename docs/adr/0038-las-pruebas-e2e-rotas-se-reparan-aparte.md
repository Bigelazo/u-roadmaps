---
status: proposed
date: 2026-11-09
---

# Las pruebas E2E rotas en `main` se reparan en un trabajo aparte

Durante el trabajo de pulido del lienzo y los Recursos (ramas `feat/canvas-ui-tweaks` a `feat/node-panel-layout`) aparecieron pruebas que fallan sin relación con esos cambios. Cuatro pruebas E2E fallan también en `main` (`bcaf553c`), así que ya estaban rotas antes. Además, dos pruebas unitarias fallaron una vez con la suite completa y pasaron al repetirla. Las ramas de trabajo no las reparan y conviven con ellas. Proponemos repararlas en un trabajo dedicado y dejarlas registradas aquí.

## Pruebas E2E que fallan en `main`

1. `tests/e2e/practice-roadmap.spec.ts:109`, «canvas actions in the teaching experience take effect and reset on reopening».
2. `tests/e2e/teaching-tutorial.spec.ts:76`, «teaching staff perform each action step of the teaching tutorial».
3. `tests/e2e/teaching-tutorial.spec.ts:372`, «the highlighted creation menu stays behind its floating button». En `main` falla en la línea 396, al esperar que el menú de creación se cierre con el segundo clic sobre el botón flotante.
4. `tests/e2e/own-notice-visibility.spec.ts:84`, «hidden Node content returns on showing, but entry recognizes hidden targets without listing them».

Las tres primeras recorren la práctica docente. El análisis de la rama de colisiones indica que fallan al conectar desde un Nodo recién creado en la práctica, pero esa causa no está confirmada. La cuarta es de Avisos y no comparte área con las otras.

## Pruebas unitarias intermitentes

- `tests/architecture/boundaries.test.ts`, «app imports a feature implementation …».
- `tests/features/roadmap/editor/NodeEditor.test.tsx`, «switches Resource panels with arrow keys…».

Fallaron una vez en una corrida completa de `pnpm test:unit:locked` después de un rebase. Pasaron al ejecutarlas solas y en la corrida completa siguiente. Antes, la primera prueba de `NodeEditor.test.tsx` también agotó una vez su tiempo límite de 5 s con la máquina cargada. Todo apunta a pruebas sensibles a la carga, pero no se ha verificado.

## Ajuste pendiente por el pulido del lienzo

`teaching-tutorial.spec.ts:372` espera que todo el menú de creación tenga la clase `driver-active-element`. Desde `feat/canvas-ui-tweaks`, el paso «Crea un nodo» resalta solo la acción «Crear nodo». Al repararla, esa aserción debe apuntar a esa acción.

## Consecuencias

- Mientras no se reparen, estas pruebas no cuentan como señal. Un fallo en cualquier otra prueba sí cuenta, según `docs/agents/testing.md`.
- La reparación empieza diagnosticando cada fallo con su traza de Playwright (`test-results/`): primero se reproduce, luego se encuentra la causa y después se corrige. No basta con aumentar tiempos de espera ni con reintentar.
- Las pruebas intermitentes se confirman ejecutándolas repetidas veces bajo carga (`--repeat-each`) antes de cambiarlas.
- Si el fallo resulta estar en la aplicación y no en la prueba, se corrige la aplicación y la prueba se conserva tal como está.
