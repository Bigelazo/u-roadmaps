# Integración SSO VTI

## Decisiones

- El RUT se persiste en `Usuario.rut` como cuerpo numérico normalizado, sin ceros iniciales, puntos, guion ni dígito verificador. Es nullable y único para no alterar usuarios existentes durante la migración.
- El correo institucional sigue siendo la identidad canónica. El RUT solo vincula un usuario existente cuando no hay conflicto; un correo y un RUT que resuelven usuarios distintos rechazan el login sin modificar datos.
- El bootstrap de un curso nuevo permite a una persona autenticada crear el `Curso` y `Roadmap` si todavía no existe el curso. No crea `Participacion`; el acceso posterior depende de la participación vigente materializada desde U-Cursos.
- Docker Compose falla cerrado si no recibe `NEXTAUTH_SECRET`, `VTI_JWT_SECRET` y `NEXT_PUBLIC_VTI_LOGIN_URL`; no se proporcionan secretos predeterminados.

## Archivos principales

- `src/lib/vti.ts`: normalización de correo y parser puro de `identification`.
- `src/lib/auth.ts`: configuración JWT de NextAuth, sesión y autorización por participación.
- `src/app/api/plogin/route.ts`: validación HS256, vinculación de identidad y cookie de sesión.
- `src/app/auth/signin/page.tsx`: acceso visual institucional.
- `src/app/api/auth/[...nextauth]/route.ts`: handlers de NextAuth.
- `prisma/schema.prisma` y `prisma/migrations/20260812010000_add_usuario_rut/`: persistencia nullable del RUT.

## Validación

- `pnpm run typecheck`: verificado.
- `pnpm test`: verificado; 14 pruebas pasan con PostgreSQL temporal en Docker.
- `pnpm run build` con secretos de build controlados: verificado.

## Archivos modificados

Además de los archivos principales anteriores, se actualizaron las rutas de roadmap existentes para exigir sesión y participación, `RoadmapCanvas.tsx` para distinguir autoría docente, `page.tsx` para navegación de sesión, `docker-compose.yml`, `.env.example`, `package.json`, `pnpm-lock.yaml` y las pruebas de integración.

Antes del despliegue deben confirmarse con VTI el formato exacto de `identification`, el secreto compartido, la URL pública de callback `/api/plogin` y los encabezados de proxy usados para detectar HTTPS.
