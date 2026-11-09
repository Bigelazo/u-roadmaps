---
status: proposed
date: 2026-11-08
---

# Restringir las Dependencias transitivas redundantes queda pospuesto

Con A → B → C, la Dependencia A → C parece redundante: a primera vista, C ya exige haber pasado por A. Se pidió impedir trazarla, con la misma mecánica del lienzo para las conexiones inválidas: el puntero atraviesa el Nodo sin ofrecer la conexión (`src/features/roadmap/graph/use-whole-node-connection.ts:87-104`). Al analizarlo, la regla resultó menos simple de lo que parece, así que se pospone y por ahora se siguen permitiendo. Este ADR deja registradas las preguntas que debe responder quien la retome.

## Por qué A → C no es siempre redundante

1. **Completaciones que sobreviven a los cambios.** Según GLOSSARY.md, los cambios posteriores del Roadmap no invalidan una Completación. Si un estudiante completó B antes de que existiera A → B, puede acceder a C sin haber completado A. Con A → C, C sigue exigiendo A. El acceso se calcula solo con los prerrequisitos directos (`studentNodeAccessById` en `src/features/roadmap/domain/access.ts`), así que la arista no es redundante para ese estudiante.
2. **Ocultar o eliminar el Nodo intermedio.** Ocultar o eliminar B quita todas sus Dependencias. Sin A → C, A y C quedan desconectados. Con A → C, el orden pedagógico entre ellos se conserva.
3. **Redundancia creada después.** Si ya existen A → B y A → C, trazar B → C vuelve redundante a A → C. La regla tendría que bloquear B → C, lo que obliga a borrar A → C antes de intercalar un Nodo, o eliminar A → C como consecuencia mostrada en la confirmación (`removedDependencyIds` ya existe en las consecuencias del cambio).
4. **Roadmaps existentes.** Habría que decidir si las aristas redundantes que ya existen se conservan, se señalan o se eliminan con una migración. La copia de un Roadmap a otra oferta de curso las arrastra.

## Mensajes que ya no se alcanzan desde la interfaz

El cliente ya descarta en silencio las conexiones hacia el mismo Nodo, las duplicadas, las que tocan Nodos ocultos y las que formarían un ciclo. Por eso los rechazos de `planDependency` (`src/features/roadmap/domain/change-impact.ts`) solo se ven por carreras entre docentes editando a la vez o por llamadas directas a la API. Son `SELF_DEPENDENCY`, `HIDDEN_NODE_DEPENDENCY_FORBIDDEN`, `DEPENDENCY_CONFLICT` y `DEPENDENCY_CYCLE`, y sus códigos HTTP están en `src/features/roadmap/application/editor.ts:88-91`. Las reglas del servidor deben conservarse porque protegen la integridad. Falta revisar si sus mensajes, y los toasts del cliente que los muestran, siguen siendo útiles o pueden reemplazarse por un mensaje genérico de conflicto. Una regla de redundancia agregaría un caso más a esta lista.

## Consecuencias

- Mientras este ADR esté propuesto, se puede trazar A → C aunque exista A → B → C.
- Quien retome la regla debe responder primero los cuatro casos anteriores y decidir si la redundancia se mide sobre todas las Dependencias o solo sobre las de Nodos visibles.
- Cualquier regla nueva debe aplicarse igual en el cliente, en `planDependency` y en la práctica docente en memoria, y conservar la mecánica silenciosa del lienzo. El modo flecha debe seguir explicando el motivo.
- El inventario de mensajes inalcanzables puede hacerse por separado, sin esperar la regla.
