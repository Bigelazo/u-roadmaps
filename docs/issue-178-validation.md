# Validación de #178 — reconocimiento en la entrada al Roadmap

Fecha: 2026-10-06. Base: `aac9d424`. Especificación:
[#178](https://github.com/Bigelazo/u-roadmaps/issues/178) y
[ADR-0014](adr/0014-target-based-notice-grouping.md).

## Revisión única

Se ejecutó `code-review` una vez, con sus dos ejes en agentes independientes,
sobre `git diff aac9d424...56acb40`. Se resolvieron todas sus sugerencias.

### Standards

Un hallazgo heurístico de nombre confuso, sin incumplimientos documentados:
el UUID generado al renderizar la página se llamaba como la operación persistida,
aunque su función es delimitar la entrada y reiniciar la sesión. Se renombró a
`roadmapEntryKey` (página y sesión) y `entryKey` (reconocimiento). `operationId`
identifica únicamente la operación persistida de preparación y reconocimiento.

### Spec

Tres hallazgos resueltos:

- Las reasignaciones de Tipo de nodo aparecían dentro del grupo del Nodo. Ahora
  aparecen en la sección final, identificando el Nodo por su título actual.
- Fallar antes de preparar la apertura hacía que todos los reintentos devolvieran
  404. Ahora una preparación incierta puede repetirse con el mismo `operationId`;
  una preparación ya confirmada conserva su conjunto y no lo reemplaza.
- El resumen y las respuestas tardías sobrevivían en el proveedor global. Ahora
  pertenecen al proveedor de la entrada, delimitado por `roadmapEntryKey`:
  abandonar o refrescar el Roadmap descarta el resumen visible y las respuestas
  de la entrada anterior, conservando el reconocimiento del servidor.

La cobertura E2E verifica las tres correcciones, además de entrada por aviso y
Resumen académico, primera entrada silenciosa, eliminación del Inbox, ausencia
de reconocimiento al abrir campana o Nodo, y refresh sin nuevos cambios.

## Comprobaciones finales

`pnpm test` ejecuta tipos, unitarios y E2E completos en secuencia, usando el
PostgreSQL local existente. Se conserva la configuración previa del usuario,
que habilita únicamente Chromium. No se incluyeron en los commits los cambios
previos en `playwright.config.ts` ni `docs/agents/testing.md`.

- TypeScript: aprobado.
- Unitarios: 61 archivos y 322 pruebas aprobadas; cero fallos u omisiones.
- E2E completos: 84 pruebas aprobadas en Chromium, cero fallos u omisiones,
  en 1,0 minuto. El comando agregado terminó con código de salida 0.
- ESLint y Prettier de los archivos modificados: aprobados.

La primera corrida completa detectó una expectativa anterior en
`student-node-access.spec.ts`: intentaba abrir el Nodo inmediatamente después
de refrescar tras un desbloqueo, mientras el nuevo resumen interceptaba el clic.
Ahora espera el Aviso de desbloqueo, comprueba el resumen, lo cierra con Entendido
y conserva todas las comprobaciones de acceso y Completación. La reproducción
individual y la corrida completa final pasaron.

`graphify update .` actualizó el grafo AST sin llamadas a modelos. Informó que los
23 archivos SQL no se analizaron porque falta `tree_sitter_sql`; las migraciones
se comprobaron mediante el despliegue y los recorridos E2E contra PostgreSQL.
