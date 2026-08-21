# Prompt para refactorizar un archivo con shadcn

Usa este prompt una vez por cada archivo TSX de produccion que no pertenezca a `src/components/ui`.

---

Quiero que refactorices de extremo a extremo el siguiente archivo:

`TARGET_FILE=<ruta-del-archivo-tsx>`

No presentes solamente un diagnostico o un plan. Investiga, implementa, verifica y entrega el resultado completo. Trabaja de forma autonoma y pregunta unicamente si encuentras una ambiguedad funcional que no pueda resolverse desde el repositorio, un conflicto directo con cambios concurrentes, una accion destructiva o una decision global no cubierta por estas instrucciones.

## Objetivo

Mejora de forma demostrable la calidad visual y tecnica de `TARGET_FILE`, adopta correctamente componentes reales de shadcn y conserva intacto su comportamiento observable.

Esta no es una conversion mecanica de tags ni una orden de eliminar todo HTML. Es una revision exhaustiva de:

- Composicion y responsabilidades React.
- Uso correcto de shadcn y de su API vigente.
- Coherencia con `DESIGN.md` y el tema global.
- Jerarquia visual, responsive, accesibilidad y movimiento.
- Rendimiento y buenas practicas de React y Next.js.
- Cobertura y evidencia de equivalencia funcional.

Debes implementar al menos una mejora real, justificada y verificable. No fabriques churn, abstracciones o cambios cosmeticos neutrales para cumplir esta condicion. Si, de forma excepcional, una auditoria exhaustiva no encuentra ninguna mejora valida, deten la implementacion y reportalo como bloqueo con evidencia; no declares exito.

Puedes eliminar `TARGET_FILE` si demuestras que es una abstraccion redundante, actualizas todos sus consumidores y mantienes el comportamiento.

## Autoridad y herramientas obligatorias

Antes de decidir o editar:

1. Carga y aplica las skills `shadcn`, `frontend-design` y `vercel-react-best-practices`.
2. Usa las herramientas de shadcn y su MCP para obtener el contexto real del proyecto, componentes instalados, registro configurado, ejemplos y API aplicable. No programes desde memoria.
3. Usa exclusivamente el registro oficial `@shadcn`. Puedes instalar componentes oficiales necesarios sin pedir permiso. No uses registros comunitarios.
4. Para componentes que vayas a usar, consulta primero su documentacion y ejemplos vigentes. Inspecciona el `base`, aliases, icon library, version de Tailwind, RSC y package manager de `components.json` o del contexto de shadcn. No asumas APIs como `asChild` o `render`.
5. Antes de modificar una primitiva instalada, previsualiza el cambio upstream con las herramientas de shadcn y revisa sus diferencias. Nunca sobrescribas cambios locales a ciegas.
6. Si el trabajo involucra React o Next.js, consulta la documentacion versionada del Next.js instalado y el runtime mediante Next.js DevTools antes de implementar. Usa el navegador real para la validacion visual y conductual cuando la superficie sea renderizable.

`DESIGN.md` es la autoridad visual del producto y prevalece ante sugerencias genericas de una skill. Usa `frontend-design` para mejorar jerarquia, ritmo, responsive, contenido, estados y movimiento dentro de esa identidad; no reinventes la marca ni crees una nueva direccion visual por archivo.

## Alcance

`TARGET_FILE` debe ser un TSX de produccion y no puede estar dentro de `src/components/ui` ni `tests`.

El archivo indicado es el centro del trabajo, no el unico archivo modificable. Puedes hacer cambios minimos y directamente atribuibles en:

- `src/components/ui`.
- El tema global y `globals.css`.
- `DESIGN.md`.
- Tests relacionados.
- Hooks, utilidades o componentes nuevos con una responsabilidad real.
- Consumidores del archivo objetivo cuando una mejora de su API interna o su eliminacion lo requiera.

No hagas la migracion visual integral de otros TSX de produccion. Dejalos para su propia ejecucion. En ellos solo puedes realizar ajustes minimos indispensables para conservar contratos, actualizar consumidores o compilar.

No reviertas, sobrescribas ni reformatees cambios ajenos. No arregles problemas no relacionados solo porque los encuentres.

## Contrato funcional y de datos

Conserva exactamente:

- Acciones y resultados visibles para el usuario.
- Navegacion y destinos.
- Estados disponibles, sus condiciones y transiciones.
- Reglas de autorizacion y autenticacion.
- Datos mostrados y semantica del contenido.
- Efectos externos y contratos HTTP.

No modifiques Prisma, migraciones, persistencia, contratos HTTP, entidades, tipos de dominio ni la semantica del modelo de datos.

Puedes cambiar props, composicion y APIs internas cuando exista un beneficio demostrado, siempre que actualices atomicamente todos sus consumidores. Puedes crear tipos de presentacion y adaptadores locales derivados; no los conviertas en cambios del dominio.

Antes de editar, escribe para ti un inventario del contrato observable y usalo como checklist de regresion. No confundas una captura visual con evidencia suficiente de equivalencia funcional.

## Regla shadcn primero

Usa una primitiva oficial de shadcn cuando represente correctamente la necesidad. Busca antes de construir. Entre otros casos:

- Acciones y controles deben usar `Button`, controles de formulario y sus composiciones oficiales.
- Superficies, feedback, estados vacios, carga, separadores, overlays, menus, navegacion y tablas deben usar la primitiva shadcn correspondiente cuando exista.
- Respeta la composicion completa y accesible de cada componente: grupos, titulos, descripciones, fallback, estados invalidos y subcomponentes requeridos.
- Compone primitivas existentes antes de crear una alternativa propia.

HTML semantico no es un fallo. Conserva o introduce los elementos nativos apropiados para documento, landmarks, encabezados, parrafos, listas, contenido y estructura cuando shadcn no tenga una abstraccion adecuada. Las integraciones especializadas, como React Flow, tambien pueden requerir markup o APIs propias.

No hagas ninguna de estas cosas:

- Crear `Box`, `Text`, `Stack` u otros wrappers cuyo unico objetivo sea esconder tags HTML o `className`.
- Reemplazar HTML semantico por un componente menos semantico para aumentar una metrica de adopcion.
- Construir con tags estilizados un control o patron que shadcn ya resuelve.
- Llamar "shadcn" a un componente de dominio propio o a markup personalizado.

Una abstraccion nueva solo se justifica si expresa una responsabilidad independiente, un concepto reusable, una API estable, un limite testeable, aislamiento de estado o efectos, o una mejora de renderizado demostrable. No extraigas componentes o hooks solo por longitud de archivo.

## Estilos y propiedad de decisiones

Ubica cada decision en la capa de menor alcance correcto:

1. **`DESIGN.md` y tema global:** decisiones visuales compartidas y durables, como color semantico, tipografia, radios, sombras y metricas con significado transversal.
2. **`src/components/ui`:** variantes visuales reutilizables de una primitiva, preferentemente mediante la API y CVA existentes.
3. **Componente de dominio:** una composicion repetida o una regla visual propia de un concepto del producto.
4. **`className` local:** layout, responsive, posicionamiento y geometria contextual que solo tienen sentido en el consumidor.

No prohibas `className` por apariencia de limpieza. En consumidores shadcn, usalo para layout o contexto, no para repetir o contradecir colores, tipografia, radios, sombras y estados que pertenecen al tema o a una variante reusable. Usa `cn()` para clases condicionales.

Antes de crear una variante o token, audita `DESIGN.md`, `globals.css` y `src/components/ui`. Reutiliza lo existente. No contamines la variante por defecto de una primitiva para resolver una sola pantalla y no agregues variantes especificas de pagina a una primitiva global.

No hardcodees decisiones visuales compartidas en JSX o TSX. Usa tokens semanticos del tema, no colores crudos ni duplicaciones de valores de marca. Se permiten valores dinamicos provenientes de datos, posiciones calculadas, geometria local justificada y colores pedagogicos definidos por el usuario; no los conviertas falsamente en design tokens.

Si falta una decision global necesaria:

1. Confirma que sera reusable y coherente con la identidad existente.
2. Documenta en `DESIGN.md` su proposito, alcance y regla de uso.
3. Implementa el token correspondiente en el archivo global de CSS indicado por shadcn.
4. Usalo semanticamente desde los componentes.

No crees un token para cada valor de una sola pantalla. No extiendas ni redefinas el sistema visual sin una razon durable.

## Diseño, responsive y accesibilidad

Analiza el archivo en el contexto de la pagina real, su audiencia y su tarea. Conserva la tesis visual de campus wayfinding establecida en `DESIGN.md`. Mejora la composicion visual si es necesario, sin cambiar la funcionalidad.

Como minimo, revisa:

- Jerarquia de informacion y orden semantico de encabezados.
- Claridad de acciones, etiquetas, estados vacios, errores y feedback.
- Layout en movil, tablet y escritorio, sin clipping ni overflow accidental.
- Targets tactiles, foco visible, navegacion por teclado y nombres accesibles.
- Contraste WCAG AA y comunicacion de estados sin depender solo del color.
- Estados normal, hover, focus, active, disabled, loading, error, vacio y contenido largo cuando apliquen.
- Semantica y requisitos de accesibilidad propios de cada primitiva shadcn.

No cambies el copy salvo que corrijas un problema objetivo sin alterar significado ni accion. Mantiene el vocabulario de una accion consistente durante todo su flujo.

## Movimiento

Realiza una auditoria explicita de movimiento en cada ejecucion. Evalua entradas, salidas, expansion, feedback, cambios de estado y continuidad espacial.

Usa `tw-animate-css` cuando el movimiento mejore comprension, feedback u orientacion. Prefiere una secuencia deliberada a efectos dispersos. No animes por cuota, no animes todos los elementos y no agregues loops ambientales que distraigan. Respeta movimiento reducido y evita que una animacion retrase tareas frecuentes o sea el unico medio de comunicar estado.

Si no corresponde agregar movimiento, explica en el informe final que transiciones evaluaste y por que la ausencia de una nueva animacion es la decision correcta. La mejora obligatoria de la ejecucion puede estar en otra dimension.

## React y Next.js

Aplica `vercel-react-best-practices` segun los problemas reales del archivo, priorizando impacto. No conviertas la skill en una lista de cambios obligatorios ni agregues optimizaciones de culto.

En particular:

- Elimina waterfalls y trabajo cliente innecesario cuando el contrato lo permita.
- Mantiene limites Server/Client Component correctos y minimiza JavaScript enviado al cliente.
- Evita estado derivado, efectos para logica de interaccion y suscripciones mas amplias de lo necesario.
- No agregues `useMemo`, `useCallback`, `memo`, lazy loading o componentes extra sin un beneficio concreto.
- No definas componentes dentro de componentes.
- Mantiene imports analizables y evita barrels costosos cuando corresponda.
- Usa patrones modernos de React solo cuando resuelvan una necesidad presente.

No sacrifiques legibilidad, semantica o una API profunda por micro-optimizaciones.

## Flujo obligatorio

1. **Validar el objetivo:** comprueba que la ruta existe, esta dentro del alcance y entiende si es Server o Client Component.
2. **Construir contexto:** lee el archivo completo, consumidores, dependencias, tests, `DESIGN.md`, `globals.css`, `components.json` y primitivas UI relevantes. Revisa el estado del worktree sin interferir con cambios ajenos.
3. **Capturar el contrato:** identifica props, estados, acciones, side effects, rutas, responsive y estados visuales. Reproduce o inspecciona la UI actual cuando sea viable.
4. **Auditar:** registra problemas concretos de shadcn, React, responsabilidades, diseño, tokens, accesibilidad, responsive y movimiento. Prioriza causas sobre sintomas.
5. **Investigar shadcn:** busca en `@shadcn`, consulta documentacion y ejemplos de los componentes candidatos, verifica que esten instalados y revisa diffs antes de modificar primitivas existentes.
6. **Decidir la composicion:** elige HTML semantico, primitivas shadcn, variantes UI y componentes de dominio segun su responsabilidad real. No uses wrappers para falsear el resultado.
7. **Implementar:** realiza el cambio minimo que resuelva de forma completa los problemas elegidos. Instala componentes necesarios, profundiza variantes reutilizables y sincroniza `DESIGN.md` con el tema cuando agregues decisiones globales.
8. **Revisar en navegador:** comprueba los estados afectados y los breakpoints relevantes en una pagina real. Usa interacciones por rol y nombre accesible. Inspecciona consola y errores de runtime. Captura evidencia visual cuando ayude a comparar.
9. **Verificar:** ejecuta lint y typecheck, tests relevantes y cualquier prueba adicional necesaria. Agrega o ajusta tests cuando cambies composicion, API interna o logica sin cobertura. Usa build o E2E completo cuando el alcance o el riesgo lo justifique.
10. **Auditar el resultado:** vuelve a leer el diff y confirma contrato funcional, capas de estilo, tokens, uso real de shadcn, HTML restante, responsive, accesibilidad, movimiento y ausencia de cambios fuera de alcance.

Si una comprobacion falla por un problema preexistente o por falta de infraestructura, separalo claramente de una regresion introducida. No declares que algo fue verificado si no lo ejecutaste.

## Condiciones de exito

La ejecucion solo esta completa si:

- Existe al menos una mejora real y demostrable, o se reporta el bloqueo excepcional descrito al inicio.
- El comportamiento observable permanece identico.
- Persistencia, dominio y contratos HTTP no cambiaron.
- Cada necesidad cubierta adecuadamente por shadcn usa su componente oficial y su composicion correcta.
- El HTML restante es semantico, estructural o necesario para una integracion, no una reinvencion estilizada de shadcn.
- No se crearon wrappers para ocultar markup ni abstracciones basadas solo en longitud.
- Las decisiones compartidas usan tokens y las variantes viven en la capa correcta.
- Cualquier extension global esta documentada en `DESIGN.md` e implementada en el tema.
- Los `className` locales se limitan a responsabilidades contextuales legitimas.
- La UI funciona en los breakpoints y estados aplicables, con accesibilidad preservada o mejorada.
- El movimiento fue evaluado y, si se agrego, es intencional y accesible.
- Las buenas practicas React/Next se aplicaron con beneficio concreto, no por ritual.
- Las comprobaciones proporcionales pasan y no hay errores nuevos de runtime o consola.

## Informe final

Entrega un resumen conciso y verificable con estas secciones:

1. **Resultado:** mejora principal y por que es mejor.
2. **Contrato preservado:** comportamiento y estados comprobados.
3. **Shadcn:** componentes oficiales instalados o usados, primitivas reemplazadas y HTML restante con justificacion semantica cuando sea relevante.
4. **Sistema visual:** variantes, componentes de dominio, tokens y cambios sincronizados entre `DESIGN.md` y `globals.css`.
5. **React/Next:** mejoras tecnicas y limites de responsabilidad modificados.
6. **Movimiento y accesibilidad:** decision tomada y estados revisados.
7. **Verificacion:** comandos, tests, rutas, breakpoints e interacciones realmente comprobados.
8. **Riesgos residuales:** solo problemas concretos no resueltos o verificaciones que no pudieron ejecutarse.

Incluye rutas de archivo en el informe. No afirmes que el archivo quedo "100% shadcn": describe con precision que responsabilidades resuelve shadcn y cuales pertenecen legitimamente a HTML, al dominio o a una integracion especializada.
