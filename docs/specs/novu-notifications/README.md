# Notificaciones con Novu: especificación y ejecución

- [Especificación](spec.md), publicada como [issue #139](https://github.com/Bigelazo/u-roadmaps/issues/139) con `ready-for-agent`.
- [Fuentes completas](sources.md): mapa #126 y sus diez hijos al recopilar, incluidos #131, #134, #135 y #136 eliminados por instrucción del usuario.
- [Tickets publicados](tickets.md): #140–#149 son cortes del MVP con `ready-for-agent` y dependencias nativas; #150 conserva el seguimiento futuro del congelamiento fuera del MVP, sin esa etiqueta.

Se aplicaron `to-spec` y `to-tickets`. El usuario aprobó los puntos de prueba (APIs autenticadas y E2E existentes sobre PostgreSQL, sustituyendo solo el transporte de Novu; validación real por separado), y luego la división y su publicación. Todos los tickets son hijos de #139. La implementación puede comenzar por #140.

Esta entrega documenta y planifica; no ejecuta implementación, pruebas de producto ni habilitación de Novu. Los cambios preexistentes del checkout no se modificaron.
