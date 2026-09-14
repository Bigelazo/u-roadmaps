# Pruebas E2E para agentes

PostgreSQL debe estar activo antes de ejecutar `pnpm run test:e2e`. La suite usa
`roadmap_e2e_db` mediante `E2E_DATABASE_URL`; Playwright aplica las migraciones,
restablece los datos ficticios y administra su propio servidor web.

El perfil de permisos del repositorio permite que los comandos sandboxed accedan
a `localhost` y `127.0.0.1`. Un error Prisma `P1001` no demuestra que PostgreSQL
esté bloqueado: primero comprueba su disponibilidad y la configuración efectiva
de permisos. No agregues wrappers ni cambies Prisma para sortear el sandbox.

Ejecuta una sola suite E2E a la vez, porque las ejecuciones comparten la base
`roadmap_e2e_db`, el puerto `3200` y el directorio `.next-e2e`.
