# Datos de desarrollo

Los datos ficticios nunca forman parte del seed general ni de la configuración de producción.

1. Con PostgreSQL nativo ya activo, crea una base local llamada `roadmap_dev_db`.
2. Configura `.env.development` con su `DATABASE_URL` y secretos locales.
3. Ejecuta `pnpm dev:data:reset`. El comando aplica las migraciones y carga los datos ficticios, incluidos los tipos de nodo predefinidos.
4. Ejecuta `pnpm dev`; Next.js carga `.env.development`.

El reset instala dos docentes, 50 estudiantes activos, cinco estudiantes retirados, cuatro ofertas académicas y roadmaps representativos. La barra `DESARROLLO` permite alternar entre las siete personas destacadas. Repetir `dev:data:reset` restaura únicamente los identificadores reservados del escenario.

La carga y las rutas de desarrollo requieren las tres condiciones: `NODE_ENV=development`, `U_ROADMAPS_DEV_DATA=true` y una URL local para la base llamada exactamente `roadmap_dev_db`.

## E2E local

1. Crea una segunda base local llamada `roadmap_e2e_db` en la misma instancia de PostgreSQL.
2. En `.env.development`, define `E2E_DATABASE_URL` para la base E2E y `U_ROADMAPS_E2E_DATA=true`.
3. Ejecuta `pnpm test:e2e`.

La suite E2E restablece solamente `roadmap_e2e_db`, aplica las migraciones, carga el mismo dataset de desarrollo y ejecuta Playwright contra un build de producción aislado en el puerto `3200`. El servidor de desarrollo y `roadmap_dev_db` permanecen disponibles. Docker se reserva para la configuración de producción.
