---
status: accepted
date: 2026-10-18
---

# Los archivos de Recursos tienen un único ciclo de vida de propiedad

La subida, la copia y la eliminación de Recursos coordinaban por separado PostgreSQL
y el volumen de archivos. Una escritura parcial podía quedar fuera de la compensación,
una limpieza fallida podía ocultar el error original y las eliminaciones confirmadas
silenciaban sus fallos de limpieza. Las dos descargas también clasificaban de manera
distinta los errores del mismo almacenamiento.

Los Recursos tienen solo dos tipos: **File resource**, cuyo archivo conserva U-Roadmaps,
y **Link resource**, que referencia una URL externa, incluidos videos y archivos alojados
fuera de la plataforma. La propiedad de bytes existentes determina su normalización:
con archivo almacenado se conserva como Archivo; sin él se convierte en Enlace. No se
descartan bytes ni se descargan URLs durante la migración. PostgreSQL protege la
consistencia entre el tipo y los metadatos del archivo. Un Archivo permite cambiar su
título; un Enlace, su título y URL. Convertir uno en otro requiere eliminarlo y crear el
Recurso correspondiente.

Un módulo de ciclo de vida concentra la preparación y propiedad provisional de archivos,
la compensación de operaciones no confirmadas, la limpieza posterior al commit y la
clasificación de lecturas. Una operación con archivos conserva su propiedad provisional
hasta que la orquestación existente confirma PostgreSQL; ante un error espera todas las
escrituras iniciadas, intenta limpiar todos sus archivos y conserva el error original.
Una colisión de creación exclusiva nunca otorga propiedad sobre un archivo ajeno.

La limpieza de una eliminación ya confirmada no cambia su resultado: se intenta para
todos los archivos y se registra cada fallo con su contexto. Esta garantía está acotada
al proceso; un fallo persistente o una caída pueden dejar archivos residuales. Se
descarta agregar una cola durable o un reconciliador porque introduciría almacenamiento,
ejecución y reglas de recuperación nuevos para un único volumen local. Tampoco se crea
un port genérico de almacenamiento: los llamadores usan el módulo y las pruebas cruzan
esa misma interfaz con PostgreSQL y directorios temporales reales.

Se preservan [ADR-0019](0019-roadmap-versions-are-frozen-roadmaps.md): identidades y bytes
independientes al copiar, y omisión del Recurso cuyo archivo de origen falta; y
[ADR-0029](0029-roadmap-writes-run-through-one-command-module.md): subidas fuera de la
transacción reintentable y creación/copia con su propia orquestación READ COMMITTED.
Solo la inexistencia del archivo produce 404 en ambas descargas; otros errores de
almacenamiento conservan su causa y producen el error 500 habitual.

La reclasificación técnica no genera Avisos. Su migración traduce valores conocidos y
capturas únicamente cuando una revisión antigua puede demostrarse equivalente con los
datos conservados; retira diferencias pendientes que pasan a ser iguales y conserva
las diferencias reales. Se prefieren esta migración puntual y los valores históricos
opacos frente a reiniciar el estado de los usuarios o mantener compatibilidad permanente
en el módulo de Avisos. Un retorno futuro a un contenido histórico no reconstruible
puede conservar un aviso redundante hasta el siguiente reconocimiento real; nunca se
reconoce ese contenido por conjetura.
