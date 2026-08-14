# Integración SSO VTI

## Decisiones

- El RUT se persiste en `User.rut` como cuerpo numérico normalizado, sin ceros iniciales, puntos, guion ni dígito verificador. Es opcional y único.
- El correo institucional sigue siendo la identidad canónica. El RUT solo vincula un usuario existente cuando no hay conflicto; un correo y un RUT que resuelven usuarios distintos rechazan el inicio de sesión sin modificar datos.
- La creación inicial de un roadmap permite a una persona autenticada crear `Course`, `CourseOffering` y `Roadmap` si todavía no existe la oferta. No crea `Participation`; el acceso posterior depende de la participación activa materializada desde U-Cursos.
- Docker Compose falla cerrado si no recibe `NEXTAUTH_SECRET`, `VTI_JWT_SECRET` y `NEXT_PUBLIC_VTI_LOGIN_URL`; no se proporcionan secretos predeterminados.

## Archivos principales

- `src/lib/vti.ts`: normalización de correo y parser puro de `identification`.
- `src/lib/auth.ts`: configuración JWT de NextAuth, sesión y autorización por `Participation`.
- `src/app/api/plogin/route.ts`: validación HS256, vinculación de identidad y cookie de sesión.
- `src/app/auth/signin/page.tsx`: acceso visual institucional.
- `src/app/api/auth/[...nextauth]/route.ts`: handlers de NextAuth.
- `prisma/schema.prisma`: persistencia opcional del RUT.

## Validación

- `pnpm run typecheck`: verificado.
- `pnpm test`: ejecuta las pruebas con PostgreSQL temporal en Docker.
- `pnpm run build`: verificado.

## Archivos modificados

Además de los archivos principales anteriores, las rutas de roadmap exigen sesión y participación. `RoadmapCanvas.tsx` distingue la autoría docente y las pruebas de integración verifican la cookie de sesión compatible.

Antes del despliegue deben confirmarse con VTI el formato exacto de `identification`, el secreto compartido, la URL pública de callback `/api/plogin` y los encabezados de proxy usados para detectar HTTPS.
