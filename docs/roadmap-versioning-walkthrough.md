# Revisión local del versionamiento de Roadmaps

Preparar `.env` y PostgreSQL como indica el [README](../README.md), ejecutar
`NODE_ENV=development pnpm dev:data:reset` y luego
`ROADMAP_CLOSURE_INTERVAL_MS=1000 pnpm dev`. Abrir
`http://localhost:3000` y cambiar de usuario desde **Perfil** o
`/development/personas`.

Si aparece la invitación al tutorial en el primer acceso al Resumen académico,
elegir **Ahora no** para continuar el recorrido.

FI1001 tiene cuatro versiones cerradas, enlazadas por copia:
**2024-2 → 2025-1 → 2025-2 → 2026-1**. La primera se creó desde cero.
CC1002 y MA1001 tienen dos versiones cerradas (**2025-2 → 2026-1**) y
su Roadmap abierto de 2026-2 fue copiado de 2026-1. Los títulos del primer
Nodo y del programa cambian entre las ediciones históricas. **FI1001 2026-2**
empieza sin Roadmap. Los cierres, la
autoría y el equipo docente están registrados al sembrar: arrancar el servidor
no los modifica. Las fechas de congelamiento históricas están en el pasado;
2026-2 usa deliberadamente una fecha futura de demostración (20 de enero de
2099), para que el recorrido siga disponible sin cambiar relojes.

## Usuarios y recorridos

| Perfil | Cargo en FI1001 | Recorrido y resultado esperado |
| --- | --- | --- |
| Daniela Rojas Mella | Profesora de cátedra de 2026-2 y 2026-1 | En `/academic-overview`, abrir **Crear roadmap** de FI1001. Se ofrece **Roadmap vacío** y **Desde una versión anterior**, con las cuatro versiones de más reciente a más antigua. **Ver** abre cada versión en otra pestaña. |
| Martín Vega Ríos | Ayudante de 2026-2 | La fila de FI1001 permite abrir **Historial de versiones**, con las cuatro ediciones. No aparece la opción de crear; se informa que solo el profesor de cátedra puede hacerlo. |
| Paula Contreras Muñoz | Profesora coordinadora de 2026-2 | Puede consultar las cuatro versiones desde la fila de FI1001, pero no crear ni copiar. |
| Sofía Herrera Díaz | Auxiliar hasta 2025-2 | En **Semestres anteriores**, abrir primavera 2025 y el historial de FI1001. Aparecen 2025-2, 2025-1 y 2024-2; el enlace directo `/courses/FI1001/versions/2026/1` tampoco da acceso. |
| Andrés Silva Pérez | Creador de 2025-2, retirado antes del cierre | Su nombre permanece como creador en el visor que abren los docentes autorizados; no aparece en el equipo docente registrado al cierre. Su Participation inactiva no le concede acceso al historial. |
| Nicolás Fuentes Arancibia | Estudiante de FI1001 2026-1 | En **Semestres anteriores**, abrir otoño 2026 y FI1001. El Roadmap cerrado permite consultar su contenido visible, sin Teacher blocks ni edición. No hay entrada al historial de versiones y `/courses/FI1001/versions` rechaza el acceso. |

En los visores de `/courses/FI1001/versions`, comprobar la sección **Creada por**,
el **Equipo docente** con sus cargos y el origen: **Creada desde cero** en
2024-2 y **Copiada de la edición 2025-2** en 2026-1. El linaje de 2026-1 muestra
las cuatro ediciones. Abrir un Nodo y descargar un archivo; no aparecen nombres de
estudiantes, Completions, progreso ni acciones de edición. El Nodo oculto sigue
disponible para inspección docente en el visor.

## Copiar y volver al estado inicial

Con Daniela, seleccionar **Edición 2026-1** en el diálogo de FI1001 2026-2 y
confirmar **Crear roadmap**. Se abre el nuevo Roadmap:

1. Los Nodos visibles empiezan con Teacher block; el Nodo oculto sigue oculto
   y no tiene bloqueo. Las Dependencias y posiciones se conservan.
2. El Custom node type de física existe y los archivos se descargan desde
   esta edición. No se arrastran Scheduled unlocks ni progreso estudiantil.
3. Cambiar a Nicolás, estudiante de 2026-2: los Nodos visibles están bloqueados
   y no revelan detalles ni Resources. El Nodo oculto no aparece.

Para verificar el origen de **la nueva copia** en el visor, simular el cierre
solo en la base local de desarrollo. Abrir `psql` con la conexión de `.env`:

```sh
pnpm exec dotenv -e .env -- sh -c 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1'
```

Ejecutar y salir con `\q`:

```sql
UPDATE "AcademicTerm"
SET "roadmapFreezeDate" = CURRENT_DATE - 2
WHERE year = 2026 AND semester = 2;
```

El período es compartido: esta simulación también cierra CC1002 y MA1001 de
2026-2. El servidor configurado arriba pasa cada segundo. Con Daniela, recargar
`/courses/FI1001/versions` hasta que aparezca **Edición 2026-2**, abrirla y
comprobar **Copiada de la edición 2026-1**, Daniela como creadora y el linaje
**2024-2 → 2025-1 → 2025-2 → 2026-1 → 2026-2**. La versión ya cerrada no tiene Teacher blocks.

Para repetir, ejecutar `NODE_ENV=development pnpm dev:data:reset` y recargar.
FI1001 2026-2 vuelve a estar sin Roadmap; se eliminan los Resources y archivos
duplicados de la copia y se restauran los archivos y las cuatro versiones históricas de Física y las de Programación y Cálculo.
Hacer este recorrido en desarrollo: la suite E2E consulta el catálogo sin
modificarlo y crea datos propios para las pruebas de copia y cierre.

Los cargos pertenecen a cada Participación, no al Usuario global: Daniela es
coordinadora en CC1002 y profesora de cátedra en MA1001 y FI1001; Nicolás es
auxiliar en CC1002, ayudante en MA1001 y estudiante en FI1001. Camila es
profesora de cátedra en CC1002 y estudiante en MA1001. Paula es coordinadora,
Martín ayudante y Sofía auxiliar. Si una carga anterior muestra «Equipo docente»,
restablecer el catálogo con el comando inicial para cargar los cargos guardados.
