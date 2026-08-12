# UNIVERSIDAD DE CHILE
## FACULTAD DE CIENCIAS FÍSICAS Y MATEMÁTICAS
### DEPARTAMENTO DE CIENCIAS DE LA COMPUTACIÓN

**DESARROLLO DE ROADMAP INTERACTIVO PARA CURSOS UNIVERSITARIOS**

PROPUESTA DE TEMA DE MEMORIA PARA OPTAR AL TÍTULO DE INGENIERO CIVIL EN COMPUTACIÓN

**DANIEL IGNACIO RAMÍREZ LÓPEZ**

**MODALIDAD:** Memoria
**PROFESOR GUÍA:** MATÍAS TORO IPINZA

SANTIAGO DE CHILE
2026

---

## 1. Introducción

En el escenario educativo actual, la formación académica y profesional posee una abundancia de información frente a una insuficiencia de estructuras organizativas. Si bien existen múltiples plataformas de aprendizaje y fuentes de conocimiento de acceso global, la capacidad de sintetizar estos recursos en trayectorias coherentes sigue siendo un desafío. En el ámbito universitario, esto se traduce en la necesidad de generar formas de acceso que permitan al estudiante transitar desde los conceptos fundamentales de una asignatura hasta la posible exploración de tópicos adicionales que, por limitaciones de tiempo o programa, suelen quedar fuera del alcance del curso regular.

Específicamente en la Facultad de Ciencias Físicas y Matemáticas de la Universidad de Chile, la gestión de contenidos se centraliza en la plataforma U-Cursos. Este sistema organiza el material académico principalmente a través de las secciones de «Material Docente» y «Enlaces». En la práctica, estas herramientas presentan la información en forma de listas de archivos o hipervínculos que, aunque permiten cierto grado de agrupación, suelen ser utilizados de manera plana y estática. La actual estructura de U-Cursos no ofrece una narrativa visual ni lógica del progreso del aprendizaje; por el contrario, delega en el estudiante la tarea de discernir el orden de importancia y la conexión entre los diversos recursos publicados. Para el equipo docente, la plataforma implica una carga administrativa redundante, al verse obligados a republicar y reorganizar material manualmente semestre tras semestre, sin una base que permita la mejora incremental y visual de la ruta pedagógica.

La problemática central radica en la ausencia de una ruta de aprendizaje definida y permanente dentro de los sistemas institucionales actuales. Esta deficiencia se manifiesta en tres ejes críticos:

* **Rigidez estructural y poca conexión:** La presentación de contenidos en U-Cursos mediante listas simples genera una falta de claridad respecto al hilo conductor de la asignatura. Para el equipo docente, esto resulta en dificultades de gestión de contenidos; para el estudiante, produce confusión y una percepción fragmentada del conocimiento, dificultando el reconocimiento de su propio progreso y de los hitos alcanzados dentro del curso.
* **Opacidad en las ramificaciones del conocimiento:** Los cursos universitarios son, por definición, introductorios en comparación con la profundidad del campo profesional. Sin embargo, no existen mecanismos formales para visibilizar hacia dónde conducen las unidades temáticas una vez finalizadas. No hay una forma clara de saber cuál es el contenido «siguiente» o avanzado, limitando la visión del estudiante sobre cómo lo aprendido se ramifica hacia especializaciones académicas o aplicaciones laborales actuales.
* **Ineficiencia en la gestión de material:** El modelo actual exige una repetición constante en la publicación de material docente y enlaces en cada nueva versión del curso. Esta falta de "memoria" del sistema impide que el conocimiento y los recursos se acumulen de forma estructurada a lo largo del tiempo, dificultando la creación de una base de información sólida que pueda ser consultada a posterior.

La importancia de esta propuesta de software reside en transformar el material académico de un curso en un recurso dinámico, persistente en el tiempo, y sobre todo, interactivo. Al implementar una visualización de la ruta del material académico con estas características, se atiende la necesidad urgente de dejar de percibir el contenido de un curso como un evento aislado y transitorio que se «limpia» al finalizar el semestre.

Motivar el desarrollo de esta herramienta tiene un valor fundamental en la formación de expertos. Dado que los programas académicos certificados deben cumplir con tiempos reglamentarios, suelen quedar excluidos tópicos complejos y de potencial interés para el estudiantado. Una solución que permita separar las unidades básicas e integrar cabida para material extra y rutas de profundización otorga al estudiante la autonomía necesaria para convertirse en un especialista de manera autodidacta.

El valor de esta solución es doble: por un lado, optimiza la labor docente al crear una estructura de contenidos reutilizable y perfeccionable con el tiempo; por otro, entrega al estudiante un mapa claro de su formación profesional en un curso. En última instancia, lo que se busca es que el paso por una asignatura no sea solo la aprobación de una serie de unidades, sino el inicio de una ruta de especialización clara, visual y conectada con los desafíos actuales del área de estudio.

---

## 2. Situación Actual

En el ámbito internacional, el concepto de roadmap interactivo ha ganado tracción principalmente en la formación técnica y el sector IT. La referencia más destacada es `roadmap.sh`, una plataforma que ofrece rutas de aprendizaje detalladas para diversos roles tecnológicos. Sin embargo, al analizar su aplicabilidad en el contexto de un curso universitario, se identifican barreras significativas. En primer lugar, la funcionalidad para que los usuarios o instituciones generen y personalicen sus propios mapas de conocimiento está restringida a modelos de suscripción de pago, lo que dificulta su adopción abierta en la academia. Además, estos mapas están orientados a perfiles laborales globales y no a la estructura pedagógica específica de una asignatura académica.

Por otro lado, han surgido diversos generadores de esquemas basados en Inteligencia Artificial (como las funciones integradas en herramientas de diagramación como Miro o herramientas específicas de IA). Si bien estas soluciones permiten crear estructuras de forma rápida, su principal falencia es la falta de profundidad e interactibilidad. Los resultados suelen ser resúmenes genéricos que no capturan la complejidad de las unidades de un curso ni permiten la integración de material docente oficial (PDFs, enlaces, bibliografía específica) de manera estructurada y persistente.

### Iniciativas y Recursos en el Contexto Local

A nivel institucional, la Facultad de Ciencias Físicas y Matemáticas (FCFM) depende casi exclusivamente de U-Cursos para la entrega de contenidos. Como se analizó anteriormente, U-Cursos funciona como un repositorio jerárquico de archivos, pero carece de una interfaz interactiva que represente el conocimiento como un camino. La información se pierde al finalizar el semestre académico, y los esfuerzos de los equipos docentes por ordenar el material en carpetas no se traducen en una herramienta de navegación para el estudiante.

En cuanto a soluciones desarrolladas por la comunidad estudiantil, destaca el proyecto `malla.eri.cl` creado por Eric Kirchgessner, ex-alumno del Departamento de Ciencias de la Computación (DCC). Esta herramienta ha tenido una excelente recepción en la comunidad, ya que permite visualizar la malla curricular y marcar el avance personal de manera local (utilizando cookies). No obstante, el alcance de este proyecto es a nivel «macro»:

* Se enfoca en la carrera completa y no en el contenido interno de cada curso.
* Su persistencia de datos es limitada (dependiente del navegador y limpieza de cache).
* No permite la integración de material de estudio o la profundización en tópicos específicos de una unidad.

### Justificación de la Propuesta

A pesar de la existencia de las herramientas mencionadas, se identifica un vacío tecnológico entre la visualización de la malla curricular (`malla.eri.cl`) y el almacenamiento estático de archivos (U-Cursos). No existe hoy una herramienta que permita a un docente o a un estudiante «mapear» el contenido de una asignatura. La necesidad de un trabajo novedoso se justifica por los siguientes pilares:

* **Interactividad y Visualización de «Micro-Rutas»:** A diferencia de los sistemas actuales, esta propuesta busca bajar al nivel de la unidad temática. Es necesario un software que no solo liste archivos, sino que permita visualizar la progresión lógica de un curso, mientras que ordene y presente estos archivos como una ruta a seguir, ayudando al estudiante a situarse espacialmente en su proceso de aprendizaje.
* **Continuidad y Profundización:** El software propuesto permitirá romper la barrera del «contenido reglamentario». Al ser una plataforma diseñada para generar roadmaps, permite dejar espacios explícitos para material de especialización que hoy se pierde en la saturación de enlaces de U-Cursos, incentivando al estudiante a ir más allá de lo mínimo exigido.
* **Persistencia y Reutilización:** A diferencia de las soluciones locales que dependen de cookies o de la publicación semestral repetitiva en U-Cursos, se requiere un sistema que permita generar un «activo de conocimiento» para el curso. Un roadmap que persista en el tiempo y que los equipos docentes puedan iterar y mejorar semestre a semestre, evitando la duplicidad de esfuerzos.
* **Adaptabilidad Académica:** A diferencia de las plataformas de pago como `roadmap.sh`, una solución interna puede adaptarse a las necesidades específicas de la FCFM, permitiendo potencialmente integraciones futuras con sistemas institucionales y manteniendo un enfoque de acceso abierto para la comunidad estudiantil.

Es así que la situación actual muestra que, si bien existe el interés por visualizar el progreso académico, las herramientas disponibles son o muy generales (`roadmap.sh`), muy administrativas (U-Cursos) o muy macro-curriculares (`malla.eri.cl`) y a modo general, limitantes en su potencial extensibilidad. Existe una oportunidad clara para desarrollar una solución que aborde la ruta interna del conocimiento de manera interactiva y persistente.

---

## 3. Objetivos

### Objetivo General
Desarrollar y evaluar un sistema de software que permita la creación, gestión y visualización de rutas de aprendizaje (roadmaps) interactivas para los cursos de la Facultad de Ciencias Físicas y Matemáticas de la Universidad de Chile, con el fin de mejorar la organización de los contenidos académicos, en el transcurso de un semestre académico.

### Objetivos Específicos
1. **Levantar y formalizar los requerimientos pedagógicos y funcionales:** Identificar las necesidades críticas de los equipos docentes y estudiantes de la FCFM respecto a la organización de contenidos. Esto implica definir qué elementos constituyen una «unidad» en el roadmap, qué metadatos son esenciales (archivos, enlaces, requisitos previos) y cómo se estructuran las ramificaciones de los tópicos del curso.
2. **Diseñar e implementar una interfaz de visualización interactiva de rutas de aprendizaje:** Desarrollar un componente visual que reemplace la estructura de listas estáticas por un esquema dinámico y jerárquico. La meta es que el estudiante pueda navegar el curso de forma espacial y lógica, permitiéndole identificar de manera inmediata su ubicación en la ruta, la conexión entre unidades y las opciones de profundización disponibles.
3. **Proveer una herramienta de autoría eficiente para el cuerpo docente:** Facilitar a los profesores la creación y edición de sus propias rutas de contenidos de forma intuitiva, permitiéndoles anexar material oficial y tópicos complementarios. El éxito de este hito se medirá por la capacidad de la herramienta para persistir estos esquemas a través del tiempo, eliminando la necesidad de reestructurar manualmente el material en cada nuevo semestre académico.
4. **Implementar un sistema de seguimiento de progreso personalizado:** Lograr que el software permita a los estudiantes marcar hitos de avance dentro de los roadmaps de manera persistente. Este sistema debe proveer una métrica visual de completitud, no solo a nivel de unidades reglamentarias, sino también en el cumplimiento de rutas de especialización sugeridas, fomentando la autonomía y la motivación del estudiante.
5. **Evaluar el impacto de la solución en la claridad y organización del aprendizaje:** Realizar una validación con usuarios (estudiantes y docentes) para contrastar la efectividad del sistema frente al uso tradicional de U-Cursos. Se medirá el grado de satisfacción, la facilidad para encontrar material y la mejora percibida en la comprensión del hilo conductor del curso a través de encuestas o pruebas de usabilidad dirigidas.

### Evaluación
Para verificar el cumplimiento de estos objetivos al finalizar el semestre, se utilizarán los siguientes criterios:
* **Funcionalidad:** El sistema debe permitir crear, visualizar y marcar el progreso en un roadmap completo de un curso piloto. Para ello, se realizarán tests End-to-end (e2e) que verificarán las funcionalidades del sistema.
* **Usabilidad y Valor:** Se analizarán los resultados de la evaluación con usuarios para determinar si la herramienta es considerada «más clara» o «mejor organizada» que el sistema de listas actual. Esto se hará mediante la *System Usability Scale* (SUS) que permitirá establecer el nivel de usabilidad que posea el software desarrollado.

---

## 4. Solución Propuesta

La solución planteada consiste en el diseño y desarrollo de una plataforma web bajo una arquitectura modular basada en **Next.js**, que transforma la experiencia de gestión de contenidos de un modelo de almacenamiento estático (carpetas y listas) a un modelo de navegación relacional (grafos y rutas).

El núcleo de la solución radica en un cambio de paradigma en el modelamiento de datos. Mientras que los sistemas actuales (como U-Cursos) utilizan una estructura de árbol jerárquico simple, este software implementará un **diseño orientado a grafos**. Cada unidad temática será tratada como un conjunto de nodos (clases, tópicos o hitos) y aristas (dependencias o requisitos previos). Esta estructura permite resolver la falta de claridad en las ramificaciones académicas, ya que el software no solo almacena el archivo, sino que computa y visualiza la relación entre los contenidos del curso.

El frontend se desarrollará como una aplicación reactiva utilizando **Next.js, React y TypeScript**, con las siguientes características:
* **Visualización Dinámica:** En lugar de presentar el material docente como una lista, se implementará un «Lienzo Interactivo» (Canvas) potenciado por la librería **React Flow**. Esta herramienta permite al estudiante «mapear» visualmente el curso. El uso de TypeScript asegura que la compleja estructura de datos del grafo sea consistente, evitando errores de navegación y permitiendo que la interfaz responda en tiempo real al progreso del usuario. Asimismo, permitirá a los docentes diseñar este Canvas de manera personalizada, anexando a los nodos el material correspondiente o las descripciones que considere apropiadas.
* **Capas de Información (Separación de Unidades):** La solución permite la creación de «capas de visibilidad». Esto resuelve el problema de los contenidos que se escapan del curso: el docente puede definir una ruta reglamentaria (visible por defecto) y «nodos de profundidad» (material extra) que el estudiante puede expandir según su interés, permitiendo que la información avanzada coexista sin saturar la vista principal.

La arquitectura de backend, construida sobre **Node.js**, abordará la necesidad de persistencia y reutilización mediante:
* **Base de Datos Relacional (SQL):** Se utilizará un modelo de datos relacional para garantizar la integridad y consistencia de las complejas conexiones que definen la trayectoria de un curso. Debido a que los roadmaps dependen de una estructura clara de requisitos y dependencias jerárquicas, el uso de SQL permite gestionar estas relaciones de forma robusta. Almacenar las rutas de manera estructurada asegura que el esfuerzo de organización del docente sea permanente: un mapa de contenidos creado en el semestre A puede ser reutilizado, actualizado y refinado para el semestre B, eliminando la carga administrativa de subir archivos de forma repetitiva.
* **Lógica de Seguimiento de Usuario:** El backend gestionará un estado de progreso individual vinculado a la identidad del estudiante, permitiendo que su «malla de conocimientos» sea accesible desde cualquier dispositivo y persista incluso después de que el curso formal haya terminado.

Para que la solución sea efectiva y usable para los equipos docentes, el software implementará un módulo interactivo para «dibujar» el flujo del curso de manera intuitiva:
* **Ingesta de Contenidos:** El docente podrá vincular recursos (enlaces, PDFs o videos) a nodos específicos.
* **Definición de Rutas:** Se podrán establecer las conexiones que definen el camino sugerido a través de la interfaz de React Flow.
