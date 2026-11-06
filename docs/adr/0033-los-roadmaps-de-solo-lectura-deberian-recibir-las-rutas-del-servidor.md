---
status: proposed
date: 2026-11-05
---

# Los Roadmaps de solo lectura deberían recibir las rutas de Dependencias desde el servidor

Las Dependencias llegan junto con los Nodos en una misma respuesta del Roadmap, pero dibujarlas requiere el motor de ruteo libavoid, un WASM de 175 KB con gzip que hoy cada participante descarga y ejecuta en su navegador. No se puede recurrir a las rutas nativas mientras carga, porque cruzan Nodos, así que esa descarga determina cuándo se ve el mapa completo en la primera visita. Hoy precargamos el motor para que el mapa aparezca completo en lugar de mostrar primero los Nodos y después las Dependencias, pero eso solo cambia una espera por otra. En una build de producción a 390x844, primera visita, Nodos y luego mapa completo: Slow 4G 3475 ms y 4740 ms sin precarga, 4339 ms y 4356 ms con ella; Slow 3G 13036 ms y 17670 ms sin precarga, 16530 ms y 16794 ms con ella. En las visitas siguientes la caché inmutable elimina casi toda la diferencia.

Proponemos calcular las rutas en el servidor para los Roadmaps de solo lectura y enviarlas junto con el Roadmap, porque quien no puede mover Nodos nunca necesita recalcular una ruta: los estudiantes tendrían el mapa completo sin descargar el motor. El equipo docente conserva el motor en el navegador, porque las rutas deben seguir al Nodo mientras se arrastra. Esto no está implementado: es un cambio de arquitectura y debe ser un issue propio.

## Consecuencias

- Las rutas dependen del tamaño de los Nodos y de obstáculos de esquina que varían según el tipo de puntero, así que el servidor necesita las mismas entradas que el navegador, o la escena de solo lectura debe dejar de depender del puntero.
- El tiempo de cálculo pasa al servidor y debe guardarse en caché por geometría. Las rutas siguen siendo un estado derivado de presentación, sin cambios en la base de datos salvo que esa caché los requiera.
- No elimina la mayor parte de la espera en redes lentas: en Slow 3G los Nodos tardan 13 s sin precarga, y eso no lo causa el motor. Reducir el JavaScript que carga el canvas es otro problema.
