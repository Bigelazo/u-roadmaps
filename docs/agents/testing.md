# Pruebas E2E para agentes

PostgreSQL debe estar activo antes de ejecutar `pnpm run test:e2e`. La suite usa
`roadmap_e2e_db` mediante `E2E_DATABASE_URL`; Playwright aplica las migraciones,
restablece los datos ficticios y administra su propio servidor web.

El perfil de permisos del repositorio permite que los comandos sandboxed accedan
a `localhost`, `127.0.0.1` y `registry.npmjs.org`. El registro de npm permite que
`pnpm` descargue paquetes y la versión indicada en `packageManager`. Con
`features.network_proxy = true`, activar la red no permite dominios que no estén
en la lista de `.codex/config.toml`. En macOS, el perfil también permite escribir
en `~/Library/pnpm/package-manager-store` para guardar la versión requerida por
el proyecto. Si cambian estos permisos, reinicia la sesión para cargar la
configuración nueva; el proxy de una sesión abierta conserva la lista anterior.

Un error Prisma `P1001` no demuestra que PostgreSQL
esté bloqueado: primero comprueba su disponibilidad y la configuración efectiva
de permisos. No agregues wrappers ni cambies Prisma para sortear el sandbox.

Ejecuta una sola suite E2E a la vez, porque las ejecuciones comparten la base
`roadmap_e2e_db`, el puerto `3200` y el directorio `.next-e2e`.
