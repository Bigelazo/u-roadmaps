---
status: accepted
date: 2026-10-07
---

# El cierre del Roadmap es un evento registrado

Hoy un Roadmap se considera congelado cuando, en cada request, `roadmapFreezeDate`
de su `AcademicTerm` ya pasó. Nada se escribe, por lo que los Teacher blocks
sobreviven al congelamiento, un Período académico sin fila nunca se congela y el
servidor de edición no rechaza cambios (solo la interfaz, las Completions y los
Scheduled unlocks consultan la fecha). Se decide que el **Roadmap closure** sea un
**evento único, irreversible y registrado**: a las 00:00 America/Santiago del día
siguiente a la **Roadmap freeze date**, un proceso periódico cierra cada Roadmap
vencido en una transacción que quita todos los Teacher blocks, descarta los
Scheduled unlocks y registra el instante del cierre. Toda autorización, en la
interfaz y en el servidor, lee ese hecho en vez de reevaluar el calendario.

## Fecha de congelamiento y respaldo

La fecha es el último día de exámenes que la sincronización del calendario oficial
obtiene una sola vez, el 15 de abril y el 15 de octubre. Si el PDF no se puede leer
o la sincronización no llegó a ejecutarse, la fecha es el **20 de julio** (primer
semestre) o el **20 de enero del año siguiente** (segundo semestre), que garantizan
que el semestre ya terminó ante cualquier atraso. Esto se aparta deliberadamente del
retirado ADR-0001, que prohibía usar fechas no publicadas: un Roadmap que nunca se
congela es peor que uno que se congela tarde.

## Consecuencias

- No hay reapertura, ni automática ni manual. Una postergación publicada después de
  la sincronización no mueve la fecha.
- El cierre es silencioso: no produce Roadmap notices y no retira los avisos
  pendientes. Un aviso pendiente de bloqueo puede quedar describiendo un estado ya
  superado; se acepta porque al final del semestre casi no quedan nodos bloqueados.
- Toda operación docente sobre un Roadmap cerrado debe rechazarse en el servidor,
  no solo ocultarse en la interfaz.
- No hay Roadmaps anteriores a 2026-2, por lo que no se requiere cierre retroactivo
  ni migración de datos.

## Alternativas consideradas

- **Seguir calculando el congelamiento al vuelo** e ignorar los Teacher blocks en
  lectura: obliga a que cada consulta recuerde la excepción y deja sin congelar los
  períodos sin calendario.
- **Resincronizar el calendario semanalmente** para seguir postergaciones: descartado
  por innecesario; la fecha de respaldo cubre los atrasos.
