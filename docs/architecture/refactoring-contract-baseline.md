# Línea base de contratos para la migración estructural

Esta línea base resuelve el issue #48 y es la puerta de preservación de comportamiento de la migración del mapa #28. Complementa el plan de [refactorización incremental](./refactoring-plan.md): no autoriza cambios de producto ni cambia la propiedad de código.

Los nombres de dominio usados aquí siguen [CONTEXT.md](../../CONTEXT.md). En particular, `courseCode/year/semester` identifica un **Curso** en un **Período académico** y las rutas de Roadmap se refieren al Roadmap opcional de ese Curso.

## Archivos especiales y pathnames de `src/app`

Los archivos de esta tabla son adapters de App Router. Las etapas posteriores pueden extraer su lógica, pero no pueden mover, renombrar ni dejar de mantener estos pathnames.

| Archivo | Contrato público |
| --- | --- |
| `layout.tsx` | Shell global, metadatos y navegación según sesión. |
| `page.tsx` | `GET /`: landing anónima; con sesión redirige a `/academic-overview`. |
| `academic-overview/page.tsx` | `GET /academic-overview`: Resumen académico; sin sesión redirige a `/api/plogin/start`. |
| `courses/[courseCode]/[year]/[semester]/page.tsx` | `GET /courses/:courseCode/:year/:semester`: Roadmap; sin sesión redirige a `/api/plogin/start`. |
| `api/**/route.ts` | Los métodos de la siguiente sección. |
| `favicon.ico`, `globals.css` | Recurso de icono y estilos globales del shell. |

## Rutas HTTP y respuestas de éxito

`:courseCode`, `:year`, `:semester`, `:nodeId`, `:typeId`, `:dependencyId` y `:resourceId` son segmentos dinámicos. Los cuerpos de error comunes son JSON `{ error: { code, message, details? } }`; la relación código/status vigente vive en `src/lib/roadmap-api.ts`. Las redirecciones y las respuestas `204` no usan este envelope.

| Método y pathname | Éxito observable |
| --- | --- |
| `GET /api/academic-overview` | `200 { source, offerings }`; cada offering expone identidad académica, rol, posición institucional y `hasRoadmap`. |
| `GET, POST /api/auth/*` | Handler de NextAuth para la sesión JWT. |
| `POST /api/development/reset` | `200 { reset: true }` en desarrollo; `404` fuera de ese entorno. |
| `POST /api/development/session` | `200 { user: { id, name } }` y cookie de sesión para una persona de desarrollo válida. |
| `POST /api/logout` | `303 /` y elimina cookies de autenticación. |
| `GET, POST /api/plogin/start` | `303` al portal VTI con `state`; si no está configurado, `303 /?error=Authentication`. |
| `GET, POST /api/plogin` | Callback VTI: `303 /academic-overview` al completarse o redirección de error de autenticación. |
| `GET /api/:courseCode/:year/:semester/roadmap` | DTO del Roadmap autorizado; estudiantes reciben su representación filtrada. |
| `POST /api/:courseCode/:year/:semester/roadmap` | `201 { roadmap: { id }, courseCode, year, semester }`. |
| `GET, POST /api/:courseCode/:year/:semester/roadmap/node-types` | Tipos disponibles; creación devuelve `201 { nodeType }`. |
| `PATCH, DELETE /api/:courseCode/:year/:semester/roadmap/node-types/:typeId` | Actualización `{ nodeType }`; borrado `204`. |
| `GET, POST /api/:courseCode/:year/:semester/roadmap/nodes` | Lista `{ nodes }`; creación `201 { node }`. |
| `GET, PATCH, DELETE /api/:courseCode/:year/:semester/roadmap/nodes/:nodeId` | Nodo individual, actualización y borrado `204`. |
| `POST /api/:courseCode/:year/:semester/roadmap/nodes/:nodeId/completion` | Completación con `{ nodeId, completedAt }`. |
| `GET, POST, DELETE, PATCH /api/:courseCode/:year/:semester/roadmap/nodes/:nodeId/teacher-block` | Previsualización, bloqueo, desbloqueo individual y desbloqueo de rama. |
| `GET, POST /api/:courseCode/:year/:semester/roadmap/nodes/:nodeId/resources` | Recursos autorizados; crea enlace o multipart con `201 { resource }`. |
| `GET /api/:courseCode/:year/:semester/roadmap/resources/:resourceId/file` | Descarga protegida con bytes y cabeceras de archivo. |
| `PATCH, DELETE /api/:courseCode/:year/:semester/roadmap/resources/:resourceId` | Actualización `{ resource }`; borrado `204`. |
| `GET, POST /api/:courseCode/:year/:semester/roadmap/dependencies` | Consulta de dependencias y creación `201`. |
| `DELETE /api/:courseCode/:year/:semester/roadmap/dependencies/:dependencyId` | `204`. |

Las rutas de Roadmap preservan además la autorización, visibilidad de Nodo, Bloqueo docente, Bloqueo por prerrequisitos, Completación y los `404` de límites entre Cursos que caracterizan las pruebas E2E. La ruta de descarga conserva el `Content-Type`, `Content-Disposition` y bytes; `fileKey` no se expone.

## Sesiones y cookies

| Superficie | Contrato que se preserva |
| --- | --- |
| Sesión de aplicación | JWT de NextAuth; el nombre es `next-auth.session-token` en HTTP o `__Secure-next-auth.session-token` en HTTPS. Es `HttpOnly`, `SameSite=Lax`, `Path=/`; su contenido no forma parte del contrato. |
| Inicio VTI | `/api/plogin/start` persiste el `state` de un solo uso y fija `u-roadmaps-vti-state`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=600`; `Secure` sólo sobre HTTPS. |
| Callback VTI | Al validar estado y claims, fija la sesión por 30 días y borra `u-roadmaps-vti-state`; si falla, también elimina el state y redirige al error. |
| Desarrollo | `/api/development/session` usa el mismo nombre de sesión, `HttpOnly`, `SameSite=Lax`, `Path=/` y duración de 30 días, exclusivamente si el entorno de desarrollo está habilitado. |
| Cierre | `/api/logout` elimina las variantes seguras/no seguras de sesión, CSRF, callback URL y state VTI antes de redirigir `303 /`. |

## Cobertura E2E existente y caracterización añadida

| Archivo | Escenarios públicos |
| --- | --- |
| `development-fixture.spec.ts` | Tres Roadmaps fixture, representación autorizada de archivos, descarga protegida y prerequisitos; además, JSON de Resumen académico, `401` anónimo y sesión de desarrollo. |
| `roadmaps.spec.ts` | Autorización y DTO Roadmap, creación, tipos, Nodos, Recursos, Dependencias, Bloqueos docentes, Completaciones, páginas de Curso/Resumen académico, VTI, landing, cierre y shell visual. |
| `student-node-access.spec.ts` | Ocultamiento de detalles/Recursos de Nodos bloqueados y restauración tras liberar. |
| `roadmap-visibility-dependencies.spec.ts` | Visibilidad de Nodo, Dependencias incidentes y propagación de Bloqueo docente. |
| `roadmap-layout.spec.ts` | Viewport, carga multipart y controles de edición. |

La caracterización añadida en #48 sólo observa HTTP, JSON, cabeceras `Set-Cookie`, redirecciones y navegador. No importa handlers ni afirma rutas internas.

## Comandos focalizados

| Superficie | Comando |
| --- | --- |
| JSON de Resumen académico, sesiones de desarrollo y fixtures | `pnpm run test:e2e -- tests/e2e/development-fixture.spec.ts` |
| Roadmap, VTI, cookies, páginas y cierre | `pnpm run test:e2e -- tests/e2e/roadmaps.spec.ts` |
| Visibilidad, Recursos y Completación de estudiante | `pnpm run test:e2e -- tests/e2e/student-node-access.spec.ts` |
| Visibilidad, Dependencias y Bloqueos docentes | `pnpm run test:e2e -- tests/e2e/roadmap-visibility-dependencies.spec.ts` |
| Viewport y multipart | `pnpm run test:e2e -- tests/e2e/roadmap-layout.spec.ts` |
| Puerta mínima del ticket | `pnpm run typecheck && pnpm run lint` |

## Registro de aliases temporales permitidos

No hay aliases temporales autorizados al crear esta línea base.

Un alias posterior sólo puede ser una reexportación sin lógica durante una etapa de la migración. Debe añadirse aquí antes de introducirlo, con el símbolo reexportado, archivo consumidor, ticket que lo introduce, ticket o condición concreta que lo retira y la Interface pública definitiva que lo reemplaza. Un alias no puede mantener dos Implementations ni una segunda fuente de verdad.

| Alias | Consumer | Introducido por | Retiro obligatorio | Interface definitiva |
| --- | --- | --- | --- | --- |
| `src/lib/roadmap-api.ts` | Rutas de desarrollo y acceso institucional aún pendientes de migración | #53 | #55, cuando cada consumer use `shared/errors` o `app/_adapters` | `shared/errors`, `app/_adapters` |
