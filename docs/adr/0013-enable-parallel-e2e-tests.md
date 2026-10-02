---
status: accepted
date: 2026-10-02
---

# Ejecutar las pruebas E2E en paralelo

Se acuerda refactorizar la suite E2E para ejecutar varios workers con casos independientes y datos aislados. Se acepta el coste de refactorización; mantener permanentemente un único worker no satisface el objetivo. La estrategia concreta se decidirá en próximas sesiones de grilling antes de implementar la migración.

Este ADR contempla únicamente la paralelización. Recuperar ahora el entorno E2E aislado, corregir los cuelgues y permitir ejecuciones consecutivas fiables forma parte de la sesión actual y no se posterga a este plan. Su configuración operativa se documentará en `docs/agents/testing.md`.

## Contexto

La configuración anterior al reset ejecutaba la suite con un worker. La reinstalación activó `fullyParallel: true`, pero los tests conservan supuestos de ejecución secuencial: usuarios y nodos con identidades compartidas, mutaciones sobre los mismos roadmaps y limpiezas globales.

La inspección encontró interferencias concretas:

- `tests/e2e/helpers.ts` expone identidades fijas utilizadas por varios archivos.
- `own-notifications.spec.ts` borra todos los avisos y reconocimientos antes de cada caso.
- Un test de ese archivo instala un trigger que rechaza cualquier inserción en `RoadmapNotice`, afectando potencialmente a otros workers.
- Progreso, simulaciones, avisos y archivos pueden sobrevivir a un caso y cambiar las precondiciones de otro.

Habilitar workers adicionales no resuelve estas dependencias. La revisión del 2026-10-01 descubrió 55 casos en Chromium y Firefox: 110 ejecuciones potencialmente competidoras. Este inventario es orientativo, no un contrato sobre el tamaño de la suite.

## Decisión

Cada test preparará el estado necesario y podrá ejecutarse individualmente, sin depender de otro caso ni de su posición en la suite. Sus mutaciones, consultas y limpiezas no afectarán al estado de otros tests.

El aislamiento deberá cubrir workers, proyectos de navegador, reintentos y reinicios de workers después de un fallo. Los datos estrictamente de lectura podrán compartirse si ninguna prueba los modifica. No se resolverá el problema introduciendo grupos seriales extensos que eliminen el paralelismo esperado.

La configuración final usará varios workers; el número se elegirá mediante mediciones de duración, CPU, memoria y conexiones a PostgreSQL. Las reproducciones individuales podrán usar un worker como herramienta de diagnóstico. La configuración provisional para recuperar el entorno se acuerda fuera de este ADR.

## Alternativas para el aislamiento

| Alternativa | Ventajas | Costes y límites |
| --- | --- | --- |
| Un servidor y una base E2E con datos exclusivos por caso | Menos procesos y configuración sencilla | Sustituir IDs compartidos, acotar consultas y limpiezas, y rediseñar efectos globales como el trigger de fallo |
| Base o esquema por worker, con servidor conectado a su partición | Aísla operaciones globales entre workers | Aprovisionamiento, migraciones y conexión coherente de aplicación y helpers; aún requiere independencia entre casos del mismo worker |
| Combinación para escenarios excepcionales | Reserva aislamiento costoso para los casos que lo necesitan | Más de un ciclo de preparación y mayor coste de mantenimiento |

La elección sigue pendiente. Crear un esquema por worker es insuficiente si las peticiones llegan a un servidor conectado al mismo esquema. El diseño debe explicar cómo las solicitudes y los helpers SQL acceden a la partición correcta, sin añadir un mecanismo inseguro a la aplicación.

Mantener permanentemente un worker se descarta como solución final por decisión explícita del usuario. Compartir datos mutables y confiar en el orden de ejecución también se descarta: impide independencia y hace que el paralelismo produzca resultados no reproducibles.

## Etapas para el plan posterior

1. **Inventariar interferencias.** Clasificar fixtures, mutaciones, limpiezas, archivos y efectos globales. Identificar casos que compiten por usuarios, roadmaps, avisos y progreso.
2. **Resolver el aislamiento mediante grilling.** Comparar las alternativas con escenarios concretos de edición concurrente, avisos por destinatario y fallo deliberado de PostgreSQL. Elegir una estrategia y documentar el ciclo de vida de sus recursos.
3. **Implementar un piloto paralelo.** Migrar casos representativos con mutaciones y efectos globales. Ejecutarlos con al menos dos workers y ambos navegadores, también individualmente y después de un fallo controlado.
4. **Migrar la suite.** Extender el patrón validado, sustituir identidades compartidas y eliminar limpiezas incompatibles. Conservar las aserciones de producto.
5. **Validar y medir.** Ejecutar la suite completa con concurrencia efectiva, comprobar independencia del orden y de ejecuciones anteriores, medir recursos y actualizar las instrucciones para agentes.

La recuperación operativa de la sesión actual será el punto de partida. Estas etapas no aplazan esa recuperación ni sus comprobaciones de terminación y repetibilidad.

## Preguntas para próximas sesiones de grilling

- ¿Qué aislamiento mínimo cubre avisos y fallos deliberados de PostgreSQL sin multiplicar innecesariamente servidores?
- ¿Qué datos deben pertenecer a cada test y cuáles pueden compartirse estrictamente para lectura?
- ¿Cómo se acota o sustituye el trigger de fallo sin debilitar el escenario que verifica?
- ¿Cómo se limpian los recursos cuando un worker falla o se reinicia, sin afectar a otros?
- ¿Se necesitan varias invocaciones simultáneas de la suite, además de workers paralelos dentro de una invocación?
- ¿Qué presupuesto de workers soportan el equipo local y el entorno de integración continua?

Se resolverán de una en una, con recomendaciones basadas en evidencia.

## Criterios de aceptación

- La suite ordinaria pasa con varios workers y los proyectos Chromium y Firefox. Las integraciones externas opcionales mantienen exclusiones explícitas; no se añaden omisiones para ocultar interferencias.
- Cada caso puede ejecutarse por separado y en otro orden, con resultados independientes de los tests anteriores.
- Los casos que antes compartían registros o efectos globales pasan concurrentemente y después de un fallo controlado.
- La preparación y limpieza de un caso o worker no altera los recursos de otro.
- La suite paralela termina, puede ejecutarse de nuevo y conserva el aislamiento respecto del entorno de desarrollo ya establecido.
- La documentación registra estrategia, comandos, número de workers y mediciones reales, sin declarar la migración completa antes de verificarlos.

## Referencias

- [Playwright: buenas prácticas y control de los datos](https://playwright.dev/docs/best-practices).
- [Playwright: paralelismo y aislamiento del estado compartido](https://playwright.dev/docs/test-parallel#avoiding-shared-state-in-parallel-tests).
- [Playwright: fixtures y ciclo de vida de recursos](https://playwright.dev/docs/test-fixtures).
