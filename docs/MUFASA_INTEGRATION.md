# Integración académica con Mufasa

## Propósito y alcance

Este documento registra la investigación del uso de Mufasa en `~/Documents/rubrica-cc5003` y define cómo adaptar esa integración a U-Roadmaps. La evidencia corresponde al commit `c30c44a16b5da593033dba14787784c1151b4f1b` del proyecto de referencia.

La separación de responsabilidades es:

- **VTI** autentica a la persona y entrega su identidad institucional.
- **U-Campus** es la fuente de cursos, secciones, integrantes, cargos y datos personales.
- **Mufasa** es el puente HTTP servidor-servidor mediante el cual se consulta U-Campus.
- U-Roadmaps materializa solo los datos académicos que necesita para sus roadmaps, acceso y progreso.

El JWT de VTI no contiene los cursos ni los roles académicos observados. El secreto de VTI y el token de Mufasa son credenciales independientes.

## Evidencia en el proyecto de referencia

Los archivos principales de `rubrica-cc5003` son:

| Archivo | Responsabilidad |
| --- | --- |
| `src/lib/mufasa.ts` | Cliente HTTP, contratos, mapeo de cargos e importación con Prisma |
| `src/app/api/mufasa/cursos/route.ts` | Lista cursos dictados por un RUT sin persistirlos |
| `src/app/api/mufasa/import/route.ts` | Importa una selección de cursos, personas e inscripciones |
| `src/app/api/courses/[courseId]/import-mufasa/route.ts` | Repite la importación para un curso local existente |
| `src/components/ImportarMufasa.tsx` | Flujo administrativo de consulta, selección e importación |
| `src/app/api/plogin/route.ts` | Verifica VTI, normaliza el RUT y crea la sesión local |
| `prisma/schema.prisma` | Persiste usuarios, cursos e inscripciones |
| `.env.example` | Declara `MUFASA_TOKEN` separado de los secretos VTI y NextAuth |

No existe un SDK: el cliente usa `fetch` nativo. Tampoco se encontraron pruebas automatizadas, mocks ni fixtures de los contratos Mufasa.

## Contrato observado

La URL usada por el proyecto de referencia es:

```text
https://apps.dcc.uchile.cl/servicios/puente/ucampus/api/fcfm_mufasa
```

Todas las consultas incluyen:

```http
Authorization: Bearer <MUFASA_TOKEN>
Accept: application/json
```

`MUFASA_TOKEN` debe permanecer exclusivamente en el servidor.

### Cursos dictados

```http
GET /cursos_dictados?rut=<cuerpo-del-rut>
```

Respuesta observada:

```ts
interface MufasaCurso {
  id_curso: number;
  codigo: string;
  nombre: string;
  seccion: string;
  ano: number;
  periodo: number;
  cargo?: string;
  id_cargo?: number | string;
}
```

El RUT usado por la referencia es el cuerpo sin puntos, guion ni dígito verificador. Los nombres de campos son `ano` y `periodo`. La referencia documenta que enviar `periodo` al endpoint produce HTTP 400, por lo que filtra año y semestre localmente.

Este es el único endpoint observado para descubrir cursos. Su uso demuestra cursos **dictados** por una persona; no demuestra que permita listar cursos actuales o históricos tomados por un estudiante.

### Cursos inscritos

El resumen académico consulta los cursos inscritos de la persona autenticada con:

```http
GET /cursos_inscritos?rut=<cuerpo-del-rut>&id_periodo=todos
```

La aplicación proyecta los campos `codigo`, `nombre`, `ano`, `periodo` y `seccion`, valida que cada curso pertenezca a un período académico válido y los agrupa por año y semestre en la interfaz. Si la respuesta está incompleta, es inválida o la consulta falla, conserva la disponibilidad del resumen usando únicamente las participaciones locales vigentes, indicadas como desactualizadas. Esta proyección no materializa participaciones.

### Integrantes

```http
GET /integrantes?id_curso[]=123&id_curso[]=456
```

Respuesta observada:

```ts
interface MufasaIntegrante {
  rut: number;
  id_cargo: number | string;
  cargo: string;
  id_curso: number;
}
```

`id_curso` identifica una sección externa. `id_cargo` puede llegar como número o texto. El proyecto de referencia usa el identificador y no el texto de `cargo` para decidir el rol.

### Personas

```http
GET /personas?rut[]=12345678&rut[]=...
```

Respuesta observada:

```ts
interface MufasaPersona {
  rut: number;
  nombre1?: string;
  nombre2?: string;
  apellido1?: string;
  apellido2?: string;
  email?: string | null;
  i?: string | null;
}
```

La referencia consulta hasta 50 RUT por solicitud para evitar URLs demasiado largas. El campo `i` contiene una fotografía. U-Roadmaps conservará todos los datos.

## Cargos observados

| `id_cargo` | Cargo | Tratamiento en `rubrica-cc5003` | Decisión para U-Roadmaps |
| ---: | --- | --- | --- |
| 0 | Alumno | `STUDENT` | `STUDENT` |
| 1 | Profesor de Cátedra | `PROFESSOR` | `TEACHER`; crea roadmaps y sincroniza rosters |
| 2 | Profesor Auxiliar | `TA` | `TEACHER`; edita y consulta progreso |
| 3 | Ayudante | `TA` | `TEACHER`; edita y consulta progreso |
| 6 | Profesor Coordinador | Omitido | `TEACHER`; edita y consulta progreso |
| 10 | Oyente | Omitido | Sin participación |
| Otro | Desconocido | Omitido | Rechazar o aislar hasta definir el mapeo |

U-Roadmaps conservará el cargo institucional además del rol simplificado. Si una persona tiene cargos docentes distintos entre secciones, aplica el más alto en toda la oferta: Ayudante, Profesor Auxiliar y Profesor de Cátedra. Profesor Coordinador participa como docente, pero no crea roadmaps ni sincroniza rosters.

## Flujo observado en `rubrica-cc5003`

1. Un administrador ingresa manualmente el RUT de un profesor y un período.
2. El servidor consulta `cursos_dictados` y filtra el período localmente.
3. El administrador selecciona cursos y secciones.
4. El navegador devuelve al servidor los objetos de curso completos.
5. El servidor agrupa secciones por código, año y período.
6. Consulta `integrantes` para todos los `id_curso` seleccionados.
7. Mapea cargos y conserva un único rol prioritario por persona y curso local.
8. Consulta `personas` en lotes de 50.
9. Crea usuarios, cursos e inscripciones con Prisma.
10. Una ruta posterior puede repetir el proceso para agregar integrantes nuevos.

VTI funciona por separado: verifica un JWT HS256, deriva el cuerpo del RUT desde `identification`, busca o crea el usuario local y emite la sesión NextAuth. La unión entre ambos flujos se realiza por el cuerpo normalizado del RUT.

## Limitaciones de la referencia

La implementación de `rubrica-cc5003` sirve para descubrir el contrato, pero no debe copiarse literalmente:

- La importación es aditiva: no desactiva a quienes desaparecen del roster.
- Un cambio de rol puede dejar varias inscripciones locales para la misma persona.
- Colapsa secciones y no persiste sus `id_curso` externos.
- Confía en código, nombre, período, sección e IDs devueltos por el navegador.
- No valida las respuestas JSON en runtime.
- No configura timeout, cancelación, reintentos ni backoff.
- Silencia cualquier error de un lote de `personas`.
- No ejecuta la importación completa dentro de una transacción.
- No registra procedencia, última sincronización ni resultado de la ejecución.
- No tiene caché explícita ni pruebas automatizadas.
- Consulta fotografías aunque después no las persiste.

## Diseño acordado para U-Roadmaps

### Identidad

El cuerpo normalizado del RUT es la identidad de enlace entre VTI y Mufasa. Nombre y correo son datos actualizables. Si RUT y correo apuntan a usuarios locales diferentes, la operación debe rechazarse y registrarse para resolución; nunca se fusionan silenciosamente.

Importar una persona desde U-Campus no significa que haya ingresado a U-Roadmaps. El ingreso se registra con el primer login VTI exitoso posterior a su incorporación al roster y se conserva también la fecha del último ingreso.

### Creación del roadmap

Un Profesor de Cátedra consulta sus cursos usando el RUT autenticado por VTI. Cuando decide crear un roadmap:

1. El servidor vuelve a consultar Mufasa; no confía en metadatos enviados por el navegador.
2. Verifica que la persona sea Profesor de Cátedra de la oferta.
3. Materializa el ramo, la oferta y todas sus secciones coordinadas.
4. Conserva cada `id_curso` externo y la sección correspondiente.
5. Obtiene y valida el roster completo de todas las secciones.
6. Obtiene los datos personales mínimos.
7. Crea el roadmap y reconcilia usuarios y participaciones en una sola transacción.

Todas las secciones de una oferta comparten contenido, orden y roadmap. La sección se conserva para representar responsabilidad académica, pero todo el equipo docente de la oferta puede editar el roadmap y ver ingreso y progreso de todos los estudiantes.

### Sincronización del roster

El roster se sincroniza al crear el roadmap y luego mediante una acción manual de un Profesor de Cátedra. Cada ejecución registra fecha, actor, secciones, resultado y errores redactados.

Solo una respuesta completa y validada se considera snapshot autoritativo:

- Crea participaciones nuevas.
- Actualiza cargo, rol y sección cuando corresponda.
- Reactiva una participación que vuelve a aparecer.
- Marca como inactiva una participación estudiantil ausente por retiro.
- Conserva participaciones y completaciones inactivas para consulta del equipo docente.
- Oculta al estudiante una oferta retirada y revoca su acceso.

Una respuesta parcial, inválida o fallida no cambia vigencias. La transacción debe evitar estados intermedios.

### Resumen académico del estudiante

La pantalla inicial muestra cursos actuales e históricos, con énfasis en los actuales. Un curso puede aparecer aunque no tenga roadmap; al abrirlo se informa que todavía no existe uno.

Los cursos sin roadmap son una proyección privada de U-Campus y no crean por sí solos `CourseOffering` ni `Participation` locales. La trayectoria completa solo es visible para el propio estudiante. El proyecto de referencia no demuestra el endpoint necesario para obtener cursos actuales o históricos tomados por un estudiante: esta capacidad es un supuesto funcional que debe verificarse antes de implementar.

### Cierre y versiones

Cada roadmap semestral es una versión dentro de la evolución del ramo. El cierre del período, obtenido desde el calendario académico oficial, congela la versión. Los estudiantes que no se retiraron conservan acceso de solo lectura desde su historial; una copia para otra oferta crea una versión sucesora con identidades nuevas, sin copiar participantes ni completaciones.

La extracción de fechas desde la página y PDF del calendario se registra en `docs/adr/0001-freeze-roadmaps-from-academic-calendar.md`. Sus detalles operativos quedan pendientes.

### Disponibilidad

Una falla de Mufasa no impide iniciar sesión por VTI ni usar roadmaps ya materializados. El resumen académico puede mostrar su última proyección conocida, marcada como desactualizada. Crear roadmaps y sincronizar rosters debe fallar sin aplicar cambios parciales.

## Configuración requerida

La integración requerirá, además de la configuración VTI existente:

```dotenv
MUFASA_TOKEN=
MUFASA_BASE_URL=https://apps.dcc.uchile.cl/servicios/puente/ucampus/api/fcfm_mufasa
```

No debe existir un valor predeterminado ni exponerse en variables `NEXT_PUBLIC_*`, logs, HTML o respuestas. La URL base debería configurarse en el servidor para permitir ambientes de prueba sin modificar código.

## Adaptación esperada del modelo

El esquema actual aún no representa todas las decisiones. La implementación deberá contemplar, al menos:

- Secciones subordinadas a `CourseOffering` con su identificador externo.
- Pertenencia de participantes a secciones.
- Cargo institucional separado de `ParticipationRole`.
- Fechas de primer y último ingreso VTI.
- Procedencia y fecha de última sincronización.
- Registro de ejecuciones de sincronización.
- Vínculo entre una versión de roadmap y su predecesora.
- Estado de cierre de la oferta y congelamiento del roadmap.
- Proyección o caché identificable como desactualizada para el resumen académico.

Estos son requerimientos de diseño, no una instrucción para copiar el esquema de `rubrica-cc5003`.

## Pruebas mínimas

La adaptación debe cubrir:

1. Contratos válidos e inválidos de los tres endpoints observados.
2. `id_cargo` numérico y textual, cargos desconocidos y jerarquía acordada.
3. Normalización y correspondencia del RUT entre VTI y Mufasa.
4. Lotes de hasta 50 personas y minimización de datos.
5. Varias secciones coordinadas sin perder sus IDs externos.
6. Creación autorizada solo para Profesor de Cátedra.
7. Selección manipulada desde el navegador.
8. Sincronización inicial, ingreso tardío, cambio de cargo, cambio de sección, retiro y reactivación.
9. Conservación del progreso de una participación retirada y revocación de su acceso.
10. Snapshot parcial, timeout, token ausente, 401, 429, 5xx y JSON inválido.
11. Rollback completo ante fallos de persistencia.
12. Login y acceso local mientras Mufasa está indisponible.
13. Separación entre proyección académica y participación materializada.
14. Congelamiento por cierre académico y acceso histórico de solo lectura.

## Preguntas abiertas

- ¿Cómo distingue ese contrato cursos aprobados, cursados, retirados y actualmente inscritos?
- ¿Cómo se descubren todas las secciones coordinadas si `cursos_dictados` solo devuelve las asociadas al RUT consultado?
- ¿Qué límites de tasa, tamaño, timeout y disponibilidad garantiza el puente?
- ¿Qué emisor, audiencia y formato exacto de `identification` garantiza VTI?
- ¿Cuál es la fuente exacta del calendario académico y cómo se validará su extracción?
