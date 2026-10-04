# U-Roadmaps

Plataforma para visualizar y gestionar rutas de aprendizaje de cursos universitarios de la Universidad de Chile. El equipo docente organiza contenidos, evaluaciones y recursos en un roadmap; los estudiantes recorren sus nodos, consultan materiales y registran su avance respetando los prerrequisitos.

Cada curso se identifica por el código del ramo, el año y el semestre, y tiene como máximo un roadmap compartido. Una persona puede participar en distintos cursos con permisos diferentes.

## Contenido

- [Funcionalidades actuales](#funcionalidades-actuales)
- [Tecnologías](#tecnologías)
- [Instalación y desarrollo local](#instalación-y-desarrollo-local)
- [Configuración](#configuración)
- [Comandos disponibles](#comandos-disponibles)
- [Pruebas](#pruebas)
- [Despliegue](#despliegue)
- [Arquitectura y estructura](#arquitectura-y-estructura)
- [Estado y limitaciones](#estado-y-limitaciones)
- [Documentación](#documentación)
- [Contribuciones y licencia](#contribuciones-y-licencia)

## Funcionalidades actuales

### Acceso y resumen académico

- Inicio de sesión institucional con U-Pasaporte mediante VTI, validación del token y de una transacción de acceso de un solo uso, y sesión local con NextAuth.
- Cierre de sesión con confirmación.
- Consulta de cursos inscritos y dictados desde U-Campus mediante el puente MUFASA, agrupados por semestre, con acceso a períodos anteriores.
- Presentación del cargo institucional, la sección cuando la fuente la entrega y la disponibilidad de un roadmap.
- Consulta de participaciones locales activas cuando U-Campus no está disponible o no está configurado.
- Materialización de la participación individual al resolver el acceso institucional a un curso.
- Creación de un roadmap vacío desde el resumen académico para quien tiene permiso de creación.

### Edición docente del roadmap

- Creación, edición y eliminación de nodos con título, descripción y tipo.
- Canvas interactivo con desplazamiento, zoom, centrado, movimiento de nodos y guardado de posiciones.
- Ordenamiento automático horizontal o vertical mediante Dagre.
- Creación y eliminación de dependencias dirigidas entre nodos del mismo roadmap, con validación de ciclos, duplicados y conexiones inválidas.
- Tipos predefinidos: **Contenido**, **Evaluación** y **Material extra**.
- Gestión de tipos personalizados por roadmap, con una paleta de 20 colores y un catálogo de 80 íconos docentes.
- Publicación y ocultamiento de nodos. Ocultar un nodo elimina sus dependencias entrantes y salientes y retira su bloqueo docente, tras confirmar el impacto.
- Bloqueo docente de nodos y propagación a sus dependientes. El desbloqueo considera los prerrequisitos bloqueados y permite liberar un nodo o una rama según el caso.
- Confirmaciones que presentan el impacto de ocultar, eliminar, conectar o cambiar bloqueos. Eliminar un nodo elimina también sus recursos, dependencias y registros de completación asociados.
- Panel de edición redimensionable, conservación de su ancho y protección de cambios sin guardar al cambiar de selección.
- Previsualización de la información de un nodo, incluidos los cambios del borrador que corresponden a esa vista.

### Recursos pedagógicos

- Recursos de tipo archivo, enlace o video, asociados a un nodo.
- Creación, edición y eliminación de referencias externas con título y URL HTTP/HTTPS.
- Subida de archivos de hasta 25 MB y descarga mediante rutas que comprueban el acceso al curso y al nodo.
- Almacenamiento de archivos subidos en el directorio `uploads/`; PostgreSQL conserva sus metadatos.

### Experiencia del estudiante y progreso

- Visualización de los nodos publicados y de sus dependencias.
- Estados de nodo **pendiente**, **completado** y **bloqueado**.
- Consulta de detalles y recursos únicamente cuando el nodo es accesible. Un nodo bloqueado permanece representado en el canvas; uno oculto queda fuera de la vista del estudiante.
- Acceso condicionado por bloqueos docentes y por la completación de la cadena de prerrequisitos.
- Registro persistente de la completación, con su fecha original. Repetir la operación conserva el registro y el estudiante no puede revertirlo.
- Conservación del progreso previo cuando aparece un bloqueo: la completación vuelve a ser efectiva al recuperar el acceso.
- Previsualización docente del canvas con las reglas del estudiante y progreso simulado independiente por participación docente y roadmap. Se puede retomar o reiniciar sin modificar el progreso real de los estudiantes.
- Detección de períodos históricos a partir de la fecha de cierre registrada: la interfaz presenta el roadmap sin controles de edición y el servidor rechaza nuevas completaciones y cambios en el progreso simulado. El cierre completo tiene limitaciones descritas más adelante.

### Avisos y actualización de información

- Campana y bandeja de avisos dentro de la aplicación, con paginación, filtros por curso y nodo, contadores de pendientes y navegación al elemento relacionado.
- Avisos propios guardados en PostgreSQL para la disponibilidad de un roadmap, la creación/publicación y edición de nodos accesibles, y los cambios de recursos.
- Selección de destinatarios según participación activa y acceso al contenido, excluyendo al autor del cambio.
- Reconocimiento contextual de avisos al entrar al roadmap o abrir el nodo correspondiente. Ver una fila o abrir el diálogo del aviso no basta para reconocerlo; las llegadas posteriores a una apertura permanecen pendientes.
- Primer aviso de Nodo inmediato y resumen separado de sus repeticiones al cerrar una ventana fija de 60 segundos, con cantidad y contexto del último cambio.
- Entrega en vivo mediante SSE para los avisos propios y la proyección del roadmap; recuperación al volver a la pestaña o recuperar la conexión, con tratamiento de borradores locales y pérdida de acceso.
- Integración transitoria y prototipos de Novu todavía presentes; su activación requiere credenciales y workflows configurados.

La sustitución de Novu por notificaciones propias está en curso. La agrupación está conectada al recorrido de Nodo; su capacidad admite las cinco clases del catálogo para su integración posterior. Las ventanas requieren un proceso de aplicación persistente y no recuperan repeticiones tras caídas. Véanse [resúmenes propios](docs/notifications-summaries.md) y [SSE](docs/notifications-sse.md).

## Tecnologías

Las versiones siguientes corresponden a las dependencias declaradas en [package.json](package.json).

| Área               | Tecnología                                                           |
| ------------------ | -------------------------------------------------------------------- |
| Aplicación y API   | Next.js 16.3.2, App Router y Route Handlers                          |
| Interfaz           | React 19.2.8, TypeScript 6, Tailwind CSS 4, shadcn/ui y Base UI      |
| Canvas             | React Flow (`@xyflow/react` 12.11.3) y Dagre                         |
| Persistencia       | PostgreSQL y Prisma 7 con adaptador `pg`                             |
| Sesión e identidad | NextAuth 4, JOSE y VTI                                               |
| Datos académicos   | U-Campus/MUFASA y lectura del calendario oficial en PDF              |
| Notificaciones     | Persistencia propia en PostgreSQL e integración transitoria con Novu |
| Pruebas            | Vitest, Testing Library y Playwright                                 |
| Herramientas       | pnpm, ESLint, Prettier y Docker Compose                              |

## Instalación y desarrollo local

### Requisitos

- Node.js 24, utilizado también por el Dockerfile.
- pnpm 11.22.0, versión declarada en `packageManager`.
- PostgreSQL activo y accesible localmente. Docker Compose utiliza PostgreSQL 15.
- Git. Docker y Docker Compose son necesarios si se utiliza el despliegue en contenedores.

### 1. Obtener el proyecto e instalar dependencias

```bash
git clone https://github.com/Bigelazo/u-roadmaps.git
cd u-roadmaps
pnpm install --frozen-lockfile
```

### 2. Configurar el entorno

Crea el archivo de desarrollo a partir de la plantilla:

```bash
cp .env.example .env
```

Ajusta `DATABASE_URL` y define un `NEXTAUTH_SECRET` local. Puedes generar un secreto con `openssl rand -hex 32`. Los archivos `.env*` con credenciales están excluidos de Git.

Para usar la demostración local, conserva `U_ROADMAPS_DEV_DATA=true`. Los perfiles ficticios permiten explorar la aplicación sin credenciales de VTI, MUFASA o Novu.

### 3. Preparar PostgreSQL

Usa el servicio PostgreSQL local existente. Crea una base de desarrollo y un usuario con permisos sobre ella. Este ejemplo coincide con los valores de desarrollo de `.env.example`; ejecútalo una sola vez con una cuenta administradora de PostgreSQL:

```sql
CREATE USER roadmap_dev_user WITH PASSWORD 'roadmap_dev_password';
CREATE DATABASE roadmap_dev_db OWNER roadmap_dev_user;
```

Si utilizas otros nombres o credenciales, actualiza `DATABASE_URL`.

### 4. Generar el cliente y cargar la demostración

```bash
pnpm prisma:generate
NODE_ENV=development pnpm dev:data:reset
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000). El botón **Cambiar perfil de desarrollo**, en la esquina inferior izquierda, permite asumir los perfiles de Daniela Rojas Mella, Nicolás Fuentes Arancibia y Camila Morales Soto.

La demostración incluye roadmaps de programación y cálculo, un curso histórico de física, un curso sin roadmap, recursos descargables y distintos escenarios de avance y bloqueo. `dev:data:reset` aplica las migraciones y reemplaza los datos reservados de la demostración; requiere una base local llamada `roadmap_dev_db` o `roadmap_e2e_db` y las banderas de fixtures correspondientes.

Para inicializar solamente el esquema y los tipos predefinidos, sin cargar los escenarios ficticios:

```bash
pnpm prisma:migrate:dev
pnpm exec dotenv -e .env -- pnpm prisma:seed
```

## Configuración

La plantilla está en [.env.example](.env.example). Next.js carga los archivos de entorno desde la raíz. Prisma usa `DATABASE_URL` del entorno; los scripts de migración cargan `.env` explícitamente.

| Variable                                  | Uso                                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                            | Conexión PostgreSQL de la aplicación y Prisma. Obligatoria.                                                                                   |
| `E2E_DATABASE_URL`                        | Conexión a la base separada de pruebas E2E.                                                                                                   |
| `NEXTAUTH_URL`                            | Origen de la aplicación; por ejemplo, `http://localhost:3000`.                                                                                |
| `NEXTAUTH_SECRET`                         | Secreto de la sesión local. Necesario para iniciar sesión, incluidos los perfiles de desarrollo.                                              |
| `NEXT_PUBLIC_VTI_LOGIN_URL`               | URL válida del servicio institucional de acceso. Necesaria para el flujo real de U-Pasaporte.                                                 |
| `VTI_JWT_SECRET`                          | Secreto acordado con VTI para validar sus tokens.                                                                                             |
| `MUFASA_TOKEN`                            | Token del puente U-Campus para consultar cursos y cargos institucionales.                                                                     |
| `MUFASA_BASE_URL`                         | URL base del puente; la plantilla incluye el endpoint institucional usado por el proyecto.                                                    |
| `NOVU_SECRET_KEY`                         | Clave privada del servidor para la integración restante con Novu.                                                                             |
| `NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER` | Identificador del mismo entorno Novu. Ambas credenciales no vacías habilitan la integración restante; los avisos propios funcionan sin ellas. |
| `U_ROADMAPS_DEV_DATA`                     | Activa el selector de perfiles cuando `NODE_ENV=development`.                                                                                 |
| `U_ROADMAPS_E2E_DATA`                     | Habilita los datos ficticios para E2E cuando se configura en el servidor.                                                                     |

El driver de la bandeja también admite `NEXT_PUBLIC_NOVU_API_URL` y `NEXT_PUBLIC_NOVU_SOCKET_URL`. El transporte servidor de Novu conserva sus endpoints predeterminados; estas variables no cambian por sí solas la región de toda la integración.

## Comandos disponibles

| Comando                                    | Descripción                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                 | Inicia Next.js en desarrollo.                                                                        |
| `pnpm build`                               | Genera el build de producción.                                                                       |
| `pnpm start`                               | Sirve un build de producción existente.                                                              |
| `pnpm lint` / `pnpm lint:fix`              | Revisa el código con ESLint / aplica correcciones automáticas.                                       |
| `pnpm format:check` / `pnpm format`        | Comprueba el formato / formatea el repositorio con Prettier.                                         |
| `pnpm typecheck`                           | Comprueba tipos sin emitir archivos.                                                                 |
| `pnpm test:unit`                           | Ejecuta la suite de Vitest; requiere cargar el entorno indicado en la sección de pruebas.            |
| `pnpm test:e2e`                            | Ejecuta Playwright con su base y servidor propios.                                                   |
| `pnpm test`                                | Ejecuta tipos, Vitest y E2E en secuencia; requiere configurar el entorno de pruebas.                 |
| `pnpm prisma:generate`                     | Genera el cliente Prisma en `src/generated/prisma`.                                                  |
| `pnpm prisma:migrate:dev`                  | Aplica las migraciones existentes usando `.env`.                                                     |
| `pnpm prisma:migrate`                      | Aplica las migraciones existentes usando `.env`.                                                     |
| `pnpm prisma:seed`                         | Carga los tipos de nodo predefinidos.                                                                |
| `pnpm prisma:prepare`                      | Genera el cliente, aplica migraciones y ejecuta el seed.                                             |
| `NODE_ENV=development pnpm dev:data:reset` | Reconstruye los escenarios locales de demostración.                                                  |
| `pnpm sync:academic-calendar`              | Obtiene y guarda las fechas oficiales del semestre actual. Requiere cargar las variables de entorno. |
| `pnpm check:notification-bundle`           | Inspecciona el build para detectar filtraciones de secretos de Novu en artefactos del navegador.     |

La sincronización del calendario puede consultar el PDF sin escribir en la base:

```bash
pnpm exec dotenv -e .env -- pnpm sync:academic-calendar --dry-run
```

Sin `--dry-run`, guarda las fechas y sus fuentes en `AcademicTerm`. El script utiliza el año y mes de `America/Santiago` para seleccionar el semestre y no instala una tarea programada.

## Pruebas

La suite de Vitest contiene pruebas de dominio, aplicación, componentes, integraciones, adaptadores HTTP y límites de arquitectura. Algunas pruebas importan el cliente de base de datos y necesitan `DATABASE_URL`. Carga el entorno y retira el origen fijo de NextAuth para los casos que comprueban distintos orígenes:

```bash
pnpm exec dotenv -e .env -- env -u NEXTAUTH_URL pnpm test:unit
```

Las pruebas E2E usan el servicio PostgreSQL local existente y una base independiente. Para los valores de la plantilla, crea una sola vez:

```sql
CREATE USER roadmap_e2e_user WITH PASSWORD 'roadmap_e2e_password';
CREATE DATABASE roadmap_e2e_db OWNER roadmap_e2e_user;
```

Configura `E2E_DATABASE_URL` en `.env`, instala los navegadores y ejecuta:

```bash
pnpm exec playwright install
pnpm test:e2e
```

Playwright prepara los fixtures y ejecuta un build de producción en `localhost:3200`, contra `roadmap_e2e_db`, con `.next-e2e` y `uploads-e2e` separados del desarrollo. Chromium y Firefox usan un worker provisional; la paralelización se abordará en el [ADR-0013](docs/adr/0013-enable-parallel-e2e-tests.md). Cada invocación administra su servidor y finaliza sin abrir el reporte HTML. Ver [instrucciones y resultados](docs/agents/testing.md).

El ensayo real de WebSocket de Novu es opcional y está separado de la ejecución habitual. Sus requisitos y evidencias se describen en [operación de Novu](docs/specs/novu-notifications/operations.md).

## Despliegue

### Servidor Node.js

Configura `.env.production` o inyecta las variables al proceso, con PostgreSQL accesible y almacenamiento persistente para `uploads/`:

```bash
pnpm install --frozen-lockfile
NODE_ENV=production pnpm exec dotenv -e .env.production -- pnpm prisma:prepare
pnpm build
pnpm start
```

Los tipos predefinidos necesitan el seed además de las migraciones. Configura VTI y MUFASA para el uso institucional y utiliza los secretos del entorno de despliegue. Las variables `NEXT_PUBLIC_*` utilizadas en código del navegador quedan fijadas durante el build; reconstruye al cambiarlas.

### Docker Compose

[docker-compose.yml](docker-compose.yml) define PostgreSQL, un servicio de migraciones y el servidor Next.js. Crea un `.env` con `POSTGRES_PASSWORD`, `NEXTAUTH_SECRET`, `VTI_JWT_SECRET` y `NEXT_PUBLIC_VTI_LOGIN_URL`; `POSTGRES_USER`, `POSTGRES_DB` y `NEXTAUTH_URL` tienen valores por defecto.

```bash
docker compose up --build -d
docker compose run --rm migrate pnpm prisma:seed
```

El servidor se publica en el puerto `3000`; PostgreSQL, en `5432`. Los datos y archivos se conservan en los volúmenes `roadmap-pgdata-v2` y `roadmap-uploads-v1`. Si PostgreSQL local ya ocupa `5432`, ajusta el puerto publicado de Compose.

La configuración actual de Compose pasa las variables de base y autenticación al servidor. Para habilitar MUFASA o la integración restante con Novu en contenedores, agrega sus variables al servicio `web` y contempla las variables públicas durante la construcción de la imagen. La configuración incluida no las propaga automáticamente.

## Arquitectura y estructura

El código se organiza por funcionalidades. Las páginas y rutas HTTP componen los módulos mediante sus entradas públicas; dentro de cada funcionalidad se separan reglas de dominio, operaciones de aplicación, infraestructura y componentes.

```text
src/
├── app/                       Páginas, layout, API y adaptadores HTTP
├── features/
│   ├── academic-overview/     Resumen académico
│   ├── institutional-access/ Acceso y cierre de sesión institucional
│   ├── notifications/        Avisos, bandeja y transportes
│   └── roadmap/              Dominio, editor, canvas, recursos y progreso
├── integrations/             VTI, U-Campus y calendario académico
├── shared/                   UI, sesión, base de datos, errores y validaciones
├── development/              Perfiles, escenarios y archivos ficticios
└── generated/prisma/         Cliente generado; no se versiona
prisma/                       Esquema, migraciones y seed
scripts/                      Reinicio de fixtures y operaciones auxiliares
tests/                        Pruebas unitarias, de integración y E2E
novu/                         Code Steps de los workflows de Novu
docs/                         ADR, especificaciones, investigación y prototipos
uploads/                      Archivos subidos; no se versiona
```

Las entidades persistidas principales son `Course`, `CourseOffering`, `Roadmap`, `RoadmapNode`, `NodeType`, `Dependency`, `Resource`, `User`, `Participation`, `Completion`, `SimulatedCompletion`, `AcademicTerm` y los registros de avisos y reconocimiento.

Las pantallas principales son `/`, `/academic-overview` y `/courses/[courseCode]/[year]/[semester]`. La API del roadmap parte de `/api/[courseCode]/[year]/[semester]/roadmap`; los avisos propios se consultan en `/api/notifications`.

## Estado y limitaciones

El proyecto está en desarrollo. Esta lista de funcionalidades describe el código presente; [CONTEXT.md](CONTEXT.md) también contiene reglas del producto que todavía requieren implementación.

- **Cierre de semestres parcial:** hay fechas oficiales, una interfaz histórica sin edición y restricciones servidor para completaciones y simulación. Todavía faltan el retiro automático de todos los bloqueos docentes al cerrar y la protección del cierre en todas las operaciones de edición del servidor.
- **Evolución del roadmap pendiente:** todavía no existe el flujo para copiar una versión anterior con nuevas identidades, archivos independientes y referencia a su origen.
- **Gestión académica incompleta:** las secciones coordinadas, el cargo institucional persistido, la importación y reconciliación del listado completo de participantes y el seguimiento docente de estudiantes aún no están implementados. Los datos ficticios de estos escenarios no prueban su disponibilidad en la aplicación.
- **Permisos institucionales en desarrollo:** con respuesta de U-Campus, la creación se reserva al profesor de cátedra y la edición se asigna a cátedra, coordinación y auxiliares. La asignación de permisos de edición a ayudantes prevista por el dominio sigue pendiente. Cuando falta la respuesta institucional, algunas operaciones utilizan la participación docente local activa.
- **Notificaciones en transición:** los avisos propios usan PostgreSQL y SSE. Los cambios de Nodo agrupan repeticiones en resúmenes; conectar las demás clases al agrupador sigue pendiente. Las ventanas se mantienen en un proceso de aplicación persistente, sin coordinación entre réplicas ni recuperación tras caídas. La entrega es de mejor esfuerzo y no incorpora recuperación durable de avisos perdidos tras guardar un cambio.
- **Almacenamiento local:** los archivos requieren conservar `uploads/`. El código actual no incorpora un servicio de almacenamiento de objetos compartido entre instancias.

El alcance del ciclo de vida pendiente está descrito en [ADR-0007](docs/adr/0007-complete-role-aware-roadmap-lifecycle.md); la sustitución de Novu, en [ADR-0012](docs/adr/0012-own-in-app-notification-delivery.md).

## Documentación

- [Modelo de dominio y vocabulario](CONTEXT.md).
- [Decisiones de arquitectura](docs/adr/).
- [Criterios visuales](DESIGN.md).
- [Especificación de notificaciones propias](docs/specs/own-notifications/README.md).
- [Especificación de la integración con Novu](docs/specs/novu-notifications/README.md).
- [Instrucciones de pruebas E2E](docs/agents/testing.md).
- [Convenciones del gestor de issues](docs/agents/issue-tracker.md).

## Contribuciones y licencia

Las tareas y solicitudes se gestionan en los issues del repositorio `Bigelazo/u-roadmaps`. Antes de contribuir, revisa [AGENTS.md](AGENTS.md), el modelo de dominio y los ADR pertinentes. Utiliza pnpm, conserva los límites entre funcionalidades y ejecuta las comprobaciones correspondientes al cambio.

El repositorio no incluye actualmente un archivo `LICENSE` ni declara una licencia en `package.json`.
