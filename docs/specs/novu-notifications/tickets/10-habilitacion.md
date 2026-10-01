# 10 — Validar el recorrido completo y habilitar el MVP de notificaciones

Issue: [#149](https://github.com/Bigelazo/u-roadmaps/issues/149). Publicado con `ready-for-agent` y `enhancement`.

## Parent

[Especificación #139](https://github.com/Bigelazo/u-roadmaps/issues/139).

## What to build

El MVP completo queda verificable y operable: se observan fallos, se distingue aceptación de entrega, se comprueban contratos reales y se habilita la integración con un procedimiento reversible.

## Acceptance criteria

- [ ] Los nueve cortes previos se integran en una matriz de recorridos reales por rol, acceso, Curso, clase de cambio, filtros, reconocimiento y actualización concurrente.
- [ ] Se verifica HMAC válido/inválido, aislamiento de suscriptores, logout/cambio de Usuario, configuración de región, bundle sin Secret Key y versiones fijadas sobre Next/React instalados.
- [ ] Con cuentas de prueba en Novu se registra evidencia de fan-out explícito por acceso, idempotencia, Digest real de 60 segundos, read/seen, timestamps, callback/socket, reconexión y conteos entre pestañas; la CI habitual mantiene transporte determinista.
- [ ] La validación cubre la carrera de reconocimiento con paginación/llegada tardía, filas no mostradas, Nodos no abiertos y read fallido sin éxito falso.
- [ ] Desktop/móvil, teclado, foco, lector de pantalla, reducción de movimiento y fecha local cumplen el contrato; queda documentada evaluación de comprensión de primera fila más resumen.
- [ ] Errores timeout/429/credenciales inválidas después del commit no afectan cambios guardados. Logs incluyen evento/workflow/Roadmap/intento/duración/resultados y no incluyen datos sensibles.
- [ ] El manifiesto operativo registra environments, región, workflows y contratos, versiones, cuotas/retención reales, procedimiento de promoción y responsable de revisar actividad/errores.
- [ ] El interruptor habilita/deshabilita integración y superficies sin bloquear el producto. La habilitación de producción requiere evidencia real satisfactoria; este ticket no compra un plan ni cambia región por suposición.
- [ ] Se ejecutan las comprobaciones del repositorio apropiadas a la implementación y la única suite E2E sobre PostgreSQL existente, sin suites paralelas compartiendo base/puerto. Se actualiza graphify después de modificar código.
- [ ] Se documentan límites: retención finita, Digest con detalle acotado y posibles pérdidas entre commit/Novu; no se promete entrega durable ni se añade tabla de avisos/outbox.

## Blocked by

- https://github.com/Bigelazo/u-roadmaps/issues/143
- https://github.com/Bigelazo/u-roadmaps/issues/145
- https://github.com/Bigelazo/u-roadmaps/issues/146
- https://github.com/Bigelazo/u-roadmaps/issues/147
- https://github.com/Bigelazo/u-roadmaps/issues/148
