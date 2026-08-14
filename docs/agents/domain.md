# Documentación de dominio

Cómo deben consumir las skills de ingeniería la documentación de dominio de este repositorio al explorar el código.

## Antes de explorar, lee lo siguiente

- **`CONTEXT.md`** en la raíz del repositorio, o
- **`CONTEXT-MAP.md`** en la raíz si existe; apunta a un `CONTEXT.md` por contexto. Lee cada uno que sea pertinente al tema.
- **`docs/adr/`**: lee los ADR que afecten el área en la que trabajarás. En repositorios multicontexto, revisa también `src/<context>/docs/adr/` para decisiones específicas del contexto.

Si alguno de estos archivos no existe, continúa silenciosamente. No señales su ausencia ni propongas crearlo de antemano. La skill `/domain-modeling`, invocada mediante `/grill-with-docs` y `/improve-codebase-architecture`, los crea de forma diferida cuando se resuelven términos o decisiones.

## Estructura de archivos

Repositorio de un solo contexto (la mayoría):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Repositorio multicontexto (presencia de `CONTEXT-MAP.md` en la raíz):

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← decisiones para todo el sistema
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← decisiones específicas del contexto
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## Usa el vocabulario del glosario

Cuando tu salida nombre un concepto de dominio, como el título de un issue, una propuesta de refactorización, una hipótesis o el nombre de una prueba, usa el término definido en `CONTEXT.md`. No uses sinónimos que el glosario evite explícitamente.

Si el concepto que necesitas aún no está en el glosario, es una señal: estás inventando lenguaje que el proyecto no usa, o existe una brecha real que debe anotarse para `/domain-modeling`.

## Señala conflictos con ADR

Si tu salida contradice un ADR existente, indícalo explícitamente en lugar de sobrescribirlo silenciosamente:

> _Contradice ADR-0007 (event-sourced orders), pero conviene reabrirlo porque..._
