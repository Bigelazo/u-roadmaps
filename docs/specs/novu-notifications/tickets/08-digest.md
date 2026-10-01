# 08 — Agrupar repeticiones en Resúmenes de cambios de Novu

Issue: [#147](https://github.com/Bigelazo/u-roadmaps/issues/147). Publicado con `ready-for-agent` y `enhancement`.

## Parent

[Especificación #139](https://github.com/Bigelazo/u-roadmaps/issues/139).

## What to build

La persona recibe el primer cambio inmediatamente y las repeticiones posteriores como otra fila de Resumen de cambios, con granularidad e información suficientes para entenderlo y reconocerlo.

## Acceptance criteria

- [ ] Los cinco workflows usan Digest Regular / When events repeat con ventana custom de 60 segundos, agrupando por suscriptor, Roadmap, Nodo y clase; los generales omiten Nodo.
- [ ] La primera fila no se modifica ni reemplaza. Eventos de otros Nodos, Cursos o clases se mantienen separados; autores diferentes pueden pertenecer al mismo grupo.
- [ ] La proyección In-App conserva el esquema de diez escalares y strings de hasta 256 caracteres, con cantidad, último momento efectivo y autor del último cambio correctamente etiquetado.
- [ ] El diálogo muestra únicamente subject/body/data reales, sin inventar arrays de eventos, cronología exhaustiva o estado neto. Una agregación cuenta como un aviso.
- [ ] Abrir Nodo reconoce cada resumen elegible como unidad junto con sus demás avisos; un resumen general se reconoce al entrar al Roadmap. Un resumen recibido después de abrir permanece pendiente.
- [ ] El manifiesto y ejemplos reproducibles documentan la configuración y proyección de los cinco workflows, incluidos cambios generales. Se resuelve en este corte cualquier limitación de configuración, sin persistencia/consolidación local.
- [ ] Pruebas deterministas cubren agrupación, reconocimiento y llegada tardía. Un ensayo explícito en Novu de pruebas registra primer aviso, resumen posterior, timestamps, data efectivo, dos clases, dos Nodos, dos Cursos y varios autores. Sin credenciales se registra pendiente el ensayo real y no se habilita producción.

## Blocked by

- https://github.com/Bigelazo/u-roadmaps/issues/142
