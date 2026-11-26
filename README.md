# U-Roadmaps

U-Roadmaps muestra un curso universitario como un mapa: cada contenido, evaluación o material es un nodo, y las flechas entre nodos dicen qué hay que aprender antes de qué. El equipo docente arma el mapa y los estudiantes lo recorren a su ritmo, marcando lo que ya completaron.

Está hecho para los cursos de la Universidad de Chile. Se entra con U-Pasaporte y los cursos y cargos de cada persona vienen de U-Campus.

## Qué se puede hacer

**Si enseñas el curso**

- Crear el roadmap del curso, vacío o copiando el de un semestre anterior.
- Agregar nodos con título, descripción en Markdown y un tipo (Contenido, Evaluación, Material extra o uno propio con su color e ícono).
- Conectar nodos para definir prerrequisitos. La aplicación impide los ciclos.
- Adjuntar archivos de hasta 10 MB o enlaces a cada nodo.
- Ocultar nodos que aún no están listos y bloquear los que no deben abrirse todavía. Un bloqueo se puede levantar a mano o programar para un día y una hora.
- Ver el roadmap como lo ve un estudiante y simular su avance sin tocar el progreso real.
- Revisar quiénes participan en el curso y cuánto ha avanzado cada estudiante.

**Si cursas el ramo**

- Ver el mapa completo del curso y en qué punto estás.
- Abrir un nodo cuando completaste sus prerrequisitos, leer su descripción y descargar sus materiales.
- Marcar un nodo como completado después de revisar sus recursos.
- Recibir avisos cuando el equipo docente cambia algo que te afecta, con un resumen de lo ocurrido desde tu última visita.

**Además**

- Cuando termina el período de exámenes, el roadmap se cierra y queda como una versión de solo lectura que el equipo docente puede consultar y copiar después.
- Una [extensión de navegador](https://github.com/Bigelazo/u-roadmaps-web-extension) muestra el roadmap dentro de cada curso de U-Cursos.

## Probarlo en tu computador

Necesitas Node.js 24, pnpm y PostgreSQL corriendo localmente.

**1. Descarga el proyecto**

```bash
git clone https://github.com/Bigelazo/u-roadmaps.git
cd u-roadmaps
pnpm install --frozen-lockfile
```

**2. Crea la base de datos**

Ejecuta esto una sola vez con una cuenta administradora de PostgreSQL:

```sql
CREATE USER roadmap_dev_user WITH PASSWORD 'roadmap_dev_password';
CREATE DATABASE roadmap_dev_db OWNER roadmap_dev_user;
```

**3. Configura el entorno**

```bash
cp .env.example .env
```

Los valores de la plantilla ya coinciden con la base del paso anterior. Solo cambia `NEXTAUTH_SECRET` por un valor propio; `openssl rand -hex 32` genera uno.

**4. Carga la demostración y arranca**

```bash
pnpm prisma:generate
NODE_ENV=development pnpm dev:data:reset
pnpm dev
```

Abre <http://localhost:3000>. No hace falta U-Pasaporte: el botón **Cambiar perfil de desarrollo**, abajo a la izquierda, te deja entrar como docente o como estudiante de cursos ficticios. La demostración trae roadmaps de programación y cálculo, versiones cerradas de física y un curso sin roadmap.

`dev:data:reset` se puede repetir cuando quieras volver al estado inicial. Solo funciona contra una base local llamada `roadmap_dev_db` o `roadmap_e2e_db`.

## Configuración

Todas las variables están en [.env.example](.env.example).

| Variable                                         | Para qué sirve                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `DATABASE_URL`                                   | Conexión a PostgreSQL. Obligatoria.                                           |
| `NEXTAUTH_URL`                                   | Dirección pública de la aplicación, por ejemplo `http://localhost:3000`.      |
| `NEXTAUTH_SECRET`                                | Secreto con que se firman las sesiones. Obligatoria para iniciar sesión.      |
| `NEXT_PUBLIC_VTI_LOGIN_URL`, `VTI_JWT_SECRET`    | Ingreso real con U-Pasaporte.                                                 |
| `MUFASA_TOKEN`, `MUFASA_BASE_URL`                | Consulta de cursos y cargos en U-Campus.                                      |
| `PROBLEM_REPORT_EMAIL`, `SMTP_URL`, `SMTP_FROM`  | Envío por correo del formulario "reportar un problema".                       |
| `U_ROADMAPS_DEV_DATA`                            | Activa los perfiles de demostración en desarrollo.                            |
| `E2E_DATABASE_URL`, `NOTIFICATIONS_DATABASE_URL` | Bases de datos de las pruebas.                                                |
| `ROADMAP_CLOSURE_INTERVAL_MS`                    | Cada cuánto se revisa si hay roadmaps que cerrar. Por defecto, cinco minutos. |

Sin las variables de U-Pasaporte y U-Campus la aplicación funciona igual con los perfiles de demostración.

## Comandos del día a día

| Comando                                      | Qué hace                                                    |
| -------------------------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                                   | Arranca la aplicación en modo desarrollo.                   |
| `pnpm build` y `pnpm start`                  | Construye y sirve la versión de producción.                 |
| `pnpm lint`, `pnpm format`, `pnpm typecheck` | Revisan estilo, formato y tipos.                            |
| `pnpm test`                                  | Corre todas las pruebas.                                    |
| `pnpm prisma:prepare`                        | Deja la base lista: cliente, migraciones y datos iniciales. |
| `NODE_ENV=development pnpm dev:data:reset`   | Restaura la demostración local.                             |
| `pnpm sync:academic-calendar`                | Lee del calendario oficial las fechas del semestre actual.  |

El resto está en la sección `scripts` de [package.json](package.json).

## Pruebas

```bash
pnpm exec playwright install chromium
pnpm test
```

Hay pruebas unitarias (Vitest), de integración con PostgreSQL real y de extremo a extremo (Playwright). Usan bases de datos separadas de la de desarrollo. La [guía de pruebas](docs/agents/testing.md) explica cómo prepararlas y cómo correr una sola suite.

## Despliegue

```bash
pnpm install --frozen-lockfile
NODE_ENV=production pnpm exec dotenv -e .env.production -- pnpm prisma:prepare
pnpm build
pnpm start
```

Tres cosas que conviene saber antes de desplegar:

- **Un solo proceso.** La aplicación debe correr como un único proceso Node que no se apague. Ese proceso entrega los cambios en vivo, libera los desbloqueos programados cada 15 minutos, cierra los roadmaps al terminar el semestre y lee el calendario académico una vez al día.
- **Los archivos viven en disco.** Lo que suben los docentes se guarda en la carpeta `uploads/`. Tiene que estar en un almacenamiento que sobreviva a los reinicios.
- **Las variables `NEXT_PUBLIC_*` se fijan al construir.** Si cambias una, vuelve a ejecutar `pnpm build`.

Si pones un proxy delante, desactiva el buffering para `/api/notifications/stream` y deja pasar cuerpos de al menos 11 MB.

## Versiones

La versión vive en el campo `version` de [package.json](package.json) y sigue [versionado semántico](https://semver.org/lang/es/): se sube el número mayor cuando un cambio obliga a migrar datos o despliegues a mano, el menor cuando se agrega una funcionalidad y el de parche cuando solo se corrigen errores. El pie de página muestra esa versión y enlaza a sus [notas de versión](https://github.com/Bigelazo/u-roadmaps/releases).

Para publicar una versión:

1. Sube `version` en `package.json` en un PR propio y fusiónalo en `main`.
2. Desde ese commit de `main`, crea la etiqueta y la versión en GitHub con el mismo número antecedido de `v`:

```bash
git switch main && git pull
gh release create v1.2.3 --target main --generate-notes
```

La etiqueta tiene que existir antes de desplegar: si no, el enlace del pie de página lleva a una página inexistente.

## Cómo está organizado el código

```text
src/
├── app/            Páginas, rutas de la API y adaptadores HTTP
├── features/       Una carpeta por funcionalidad: roadmap, avisos,
│                   resumen académico e ingreso institucional
├── integrations/   U-Pasaporte (VTI), U-Campus y calendario académico
├── shared/         Componentes de interfaz, sesión, base de datos y validaciones
└── development/    Perfiles y datos de la demostración
prisma/             Esquema, migraciones y datos iniciales
tests/              Pruebas unitarias, de integración y E2E
docs/               Decisiones de arquitectura y guías
```

Está construido con Next.js 16, React 19, TypeScript, PostgreSQL con Prisma, Tailwind CSS y React Flow para el canvas.

## Limitaciones conocidas

- Al cerrarse un semestre, el servidor rechaza nuevas completaciones, pero aún no protege todas las operaciones de edición docente.
- Los permisos de edición para ayudantes todavía no están implementados.
- Los avisos se entregan con el mejor esfuerzo: si el proceso cae justo después de guardar un cambio, ese aviso puede perderse.
- No hay almacenamiento de archivos compartido entre varias instancias.

## Para saber más

- [GLOSSARY.md](GLOSSARY.md): el vocabulario del dominio y sus reglas.
- [docs/adr/](docs/adr/): por qué se tomó cada decisión de arquitectura.
- [DESIGN.md](DESIGN.md) y [PRODUCT.md](PRODUCT.md): criterios visuales y de producto.
- [AGENTS.md](AGENTS.md): instrucciones para agentes de código que trabajan en el repositorio.

## Contribuir

Las tareas se gestionan en los [issues del repositorio](https://github.com/Bigelazo/u-roadmaps/issues), en inglés. Antes de proponer un cambio, revisa el glosario y los ADR relacionados, y corre `pnpm lint`, `pnpm typecheck` y las pruebas que correspondan.

## Licencia

[Apache 2.0](LICENSE).
