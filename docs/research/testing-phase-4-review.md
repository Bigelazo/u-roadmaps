# Revisión de etapa 4: sensibilidad y guardrails

Investigado el 2026-11-05 sobre el checkout actual. Auditoría documental y de
código; no se ejecutaron suites ni alteraciones negativas, y no se cambiaron
producción, pruebas o configuración. Se consultó `graphify query "testing
architecture ESLint guardrails mocking errors http"`; el resultado condujo a
`tests/architecture/boundaries.test.ts`, `eslint.config.mts` y los contratos HTTP.
Las estimaciones siguientes son líneas físicas agregadas/eliminadas durante una
implementación futura, no un diff ejecutado ni una promesa de esfuerzo.

## Recomendación

**Cambiar la etapa independiente por criterios de cierre dentro de etapas 1–3.**
La comprobación de sensibilidad pertenece al test que pretende acreditar cada
riesgo: permite corregir fixture y aserción mientras ese recorrido está fresco.
Mantener una entrega final pequeña de guardrails es razonable, pero no debería
bloquear las reparaciones HTTP/UI/SQL ni acumular una segunda matriz de tests.

Conservar las alteraciones manuales dirigidas, sin instalar una plataforma de
mutación. Conservar una pauta breve en la guía existente. El guardrail estático
es opcional y acotado a reemplazos observados; descartar por ahora una regla
general de aliases/spyOn y un nuevo `CODING_STANDARDS.md`.

## Evidencia local y consecuencias

- `tests/app/api/{dependency,resources,teacher-block,roadmap-node-type-classification}-notifications.test.ts`
  contienen `vi.mock('@/shared/errors/server', ...)`; son un patrón concreto que
  puede impedir ESLint. `tests/app/_adapters/http.test.ts` conserva ese módulo,
  aunque reemplaza Prisma. No confundir ambos defectos.
- `eslint.config.mts` ya tiene bloques por glob, reglas de Vitest, Testing Library
  y límites arquitectónicos. No requiere plugin nuevo para un selector AST.
- `tests/architecture/boundaries.test.ts` ya usa `ESLint.lintText` con `filePath` y
  configuración real. Puede reutilizarse ese enfoque con fragmentos positivos y
  negativos; no hace falta escribir archivos físicos para comprobar mocks.
- Su helper actual devuelve únicamente IDs de reglas. Para este guardrail conviene
  comprobar también el mensaje o `messageId` y ausencia de errores de parser:
  otra infracción de `no-restricted-syntax` no acredita el selector buscado.
- `lefthook.yml` ejecuta lint de archivos staged al commit; CI ejecuta `pnpm lint`
  completo y unitarios/integración. No agregar scripts, hooks ni jobs. La prueba
  arquitectónica entra en la suite existente.
- `docs/agents/testing.md` ya documenta locks, worktrees, fallos ambientales y
  evidencia. Solo necesita una subsección breve sobre elección del recorrido y
  sensibilidad; evitar duplicar instrucciones de ejecución.
- `.agents/skills/code-review/SKILL.md`, paso 3, pide buscar **todos** los archivos
  que documentan estándares; exige incluir `CODING_STANDARDS.md` solo **cuando
  existe**. No requiere crearlo. La guía de testing ya puede ser fuente de revisión.

## Menor regla fiable

Usar un bloque `files: ['tests/app/api/**/*.test.ts']` con un mensaje explícito:
«Estos contratos deben conservar normalizador y adaptador HTTP reales». Agregar
el test del adaptador solo si se desea exigirle el mismo contrato. La política
es para tests que se presentan como contratos HTTP; una prueba aislada futura
que pruebe otra cosa debe tener alcance declarado antes de ampliar el glob.

El selector debe identificar la llamada completa, con receptor `vi`, propiedad
`mock` o `doMock` no computada y **primer argumento** igual al módulo protegido.
Incluir dos formas de argumento: literal string y `ImportExpression` cuya
`source` sea ese literal. Evitar seleccionar cualquier descendiente literal:
un import usado dentro de una factory no equivale a reemplazar ese módulo.

Proteger exactamente `@/shared/errors/server` y `@/app/_adapters/http`; los imports
relativos o aliases adicionales no quedan resueltos por comparar strings. El
AST de `import()` debe comprobarse con el parser realmente configurado antes de
fijar el selector. ESLint permite selectores AST y mensajes particulares, pero
no aporta resolución semántica de módulos en `no-restricted-syntax`.
[Fuente: ESLint](https://eslint.org/docs/latest/rules/no-restricted-syntax).

Casos mínimos: rechazar ambos métodos × ambos módulos × string/import; permitir
mocks de sesión/feature, import normal del módulo protegido y llamadas fuera del
glob. Agregar un ejemplo de `vi.mock(path, { spy: true })`: la regla mínima lo
rechazará aunque conserve implementación. Esa restricción sintáctica deliberada
necesita constar en el mensaje/pauta; no debe describirse como detector universal
de implementaciones falsas. Vitest permite ambas firmas y `spy: true`.
[Fuente: API de Vitest](https://vitest.dev/api/vi.html#vi-mock).

Una regla que resuelva `import { vi as testApi }`, namespace `vitest`, destructuring,
variables de módulos, imports relativos, reexports y `spyOn(namespace, 'export')`
ya necesita análisis de bindings y origen del objeto. Además debe distinguir
spy que observa del que hace `mockImplementation` o `mockReturnValue`, y mocks
parciales que preservan el export relevante. Es otra herramienta mantenible con
su propia matriz de falsos positivos; no es una extensión gratuita del selector.
No hay reincidencia observada que justifique ese coste. La revisión humana cubre
sustituciones indirectas, sin afirmar que lint las detecta.

El guardrail del editor/detalle es también opcional: restringirlo al archivo de
composición elegido y sus paths reales después de implementarlo. No aplicarlo a
`RoadmapCanvasSession.test.tsx`, cuyo propósito aislado acepta hijos sustituidos.

## Sensibilidad: qué conservar y qué corregir

Obligatorio para cada riesgo prioritario: baseline verde del caso seleccionado,
una alteración semántica temporal, fallo atribuible a la expectativa pública y
restauración con el mismo caso verde. Guardar comando, test, aserción, diff y
resultado. Un único mutante por vez; evitar ejecutar toda la suite por mutante.
Usar worktree/snapshot exacto, locks y restauración incluso ante interrupción.

No acreditar un mutante por código de salida distinto de cero. Importación fallida,
Prisma no generado, URL faltante, error TypeScript, consulta inválida, driver sin
conexión o teardown roto son fallos de infraestructura. Eliminar DISTINCT debe
mantener SQL válido y datos que realmente distingan filas/destinos. Los datos de
otro usuario/participación deben sobrevivir los triggers y alcanzar la consulta.

Un timeout UI merece matiz: un botón permanentemente bloqueado puede ser el
defecto observable esperado. Es evidencia si la espera localizada falla afirmando
que la siguiente acción esté habilitada, con operación recibida y promesa resuelta;
un timeout global del runner o montaje que nunca carga el editor no lo es. No
exigir una aserción síncrona artificial para evitar todo timeout.

`src/shared/errors/server.ts:11` invoca `unstable_rethrow` antes de normalizar.
El mutante HTTP debe distinguir errores comunes que se convierten en 500 de
control de flujo de Next que debe propagarse. Usar `redirect`/`notFound` reales
o el mecanismo real ya adoptado; no inventar un objeto con un mensaje parecido.
La documentación oficial confirma que esas funciones lanzan errores internos y
que `unstable_rethrow` impide capturarlos como errores de aplicación.
[Fuente: Next.js](https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow).
Esto no añade una nueva regla universal de «el handler nunca rechaza».

Antes de crear otro test, intentar que el mutante falle con los existentes:
`NodeEditor.test.tsx` ya contiene segunda edición, Strict Mode, cambio de Nodo,
Activity y reintento; `canvas-preview-reset.test.tsx` ya reproduce reinicio;
`inbox-visibility.test.ts` y `title-lifecycle.test.ts` ya prueban conteos. Registrar
qué caso detectó cada mutación; no atribuir a un test nuevo una garantía que ya
existía ni duplicar cobertura solo para cerrar una tabla.

## LOC y alcance propuesto

| Entrega | Producción + / − | Tests + / − | Config + / − | Docs + / − |
| --- | --- | --- | --- | --- |
| Requerido: sensibilidad integrada a 1–3 y pauta breve | 0 / 0 | 0–20 / 0–10 | 0 / 0 | 20–40 / 0–10 |
| Opcional recomendado: selector HTTP + pruebas con ESLint real | 0 / 0 | 45–85 / 0 | 20–40 / 0 | 5–10 / 0 |
| Opcional: restricción del test de composición elegido | 0 / 0 | 15–30 / 0 | 8–15 / 0 | 0–5 / 0 |
| Pospuesto: regla local general de bindings/spyOn | 0 / 0 | 100–200 / 0 | 90–180 / 0 | 10–20 / 0 |

La primera fila admite cero cambios de tests: ejecutar y documentar sensibilidad
no exige agregar código permanente. Sus hasta 20 líneas son ajuste de una aserción
ya existente si el mutante revela debilidad; contabilizarlo en la etapa respectiva
para evitar doble conteo. Los cambios temporales de mutación tienen neto cero.
La regla local se cuenta como tooling/config, no producción de la aplicación.
No incluirla en el total recomendado. Tampoco incluir este informe como LOC de
la implementación futura.

Total mínimo requerido: **20–60 líneas agregadas, 0–20 eliminadas**. Con guardrail
HTTP: **90–195 agregadas, 0–20 eliminadas**. El guardrail UI suma otras 23–50.
No se propone eliminar archivos ni crear un estándar raíz. Las cifras dependen
de formato y parametrización; los límites superiores no son objetivos de tamaño.

## Keep / change / drop

- **Mantener:** mutantes manuales dirigidos, evidencia de aserción y restauración,
  worktree exacto y locks, CI actual, revisión del recorrido real.
- **Cambiar:** sensibilidad al cierre de cada etapa; timeout localizado puede
  detectar bloqueo; regla AST solo promete patrones estáticos; aprovechar el
  harness ESLint existente y probar casos permitidos además de prohibidos.
- **Descartar de esta entrega:** etapa de sensibilidad separada, plataforma
  Stryker, resolución general de aliases/spyOn, nuevo `CODING_STANDARDS.md`,
  cambios de CI/hooks y una matriz duplicada de pruebas de regresión.
