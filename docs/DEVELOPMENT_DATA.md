# Datos de desarrollo

Los datos ficticios nunca forman parte del seed general ni de la configuración de producción.

1. Copia `.env.development.example` a `.env.development.local` y define un secreto local.
2. Ejecuta `pnpm dev:db` para iniciar PostgreSQL en `localhost:5434`.
3. Ejecuta `DATABASE_URL=postgresql://roadmap_dev_user:roadmap_dev_password@localhost:5434/roadmap_dev_db pnpm prisma:migrate`.
4. Ejecuta `DATABASE_URL=postgresql://roadmap_dev_user:roadmap_dev_password@localhost:5434/roadmap_dev_db pnpm dev:data:reset`. Este comando también instala los tipos de nodo predefinidos.
5. Ejecuta `pnpm dev` con las variables de `.env.development.local`.

El reset instala dos docentes, 50 estudiantes activos, cinco estudiantes retirados, cuatro ofertas académicas y roadmaps representativos. La barra `DESARROLLO` permite alternar entre las siete personas destacadas. Repetir `dev:data:reset` restaura únicamente los identificadores reservados del escenario.

La carga y las rutas de desarrollo requieren las tres condiciones: `NODE_ENV=development`, `U_ROADMAPS_DEV_DATA=true` y una URL local para la base llamada exactamente `roadmap_dev_db`.
