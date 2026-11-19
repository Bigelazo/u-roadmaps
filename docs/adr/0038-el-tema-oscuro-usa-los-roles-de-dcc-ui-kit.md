---
status: accepted
date: 2026-11-14
---

# El tema oscuro usa los roles de dcc-ui-kit y se elige explícitamente

U-Roadmaps solo tenía tema claro, con identidad propia (azul para acciones, jade para progreso). Al agregar un tema oscuro decidimos que sus colores vengan completos de los roles oscuros de [dcc-ui-kit](https://dcc-fcfm-uchile.github.io/dcc-ui-kit/site/) (superficies, texto, bordes, acento, foco y estados) y de su paleta, sin el azul ni el jade, y sin colores que no estén en el `styles.css` del kit. La distribución copia la del sitio de documentación del kit y no la de `.dcc-root`: toda la página va sobre `--dcc-surface` (`#19202b`) en vez de `--dcc-bg` (`#11161e`), las tarjetas se distinguen por un borde sutil y no por relleno, y la navegación global es una barra Grey/Default con contenido blanco. Con `--dcc-bg` de fondo y la navegación del mismo color, el tema se veía demasiado oscuro. El tema claro no cambia. Donde el kit fija un color de marca, como el rojo de la pestaña activa, se respeta aunque su contraste sea menor.

El tema es opt-in, como en el kit: un botón en la navegación global alterna entre claro y oscuro, con claro por defecto y sin seguir la preferencia del sistema. La preferencia se guarda en la cookie `theme` y no en `localStorage`: así el servidor renderiza `data-theme` en `<html>` sin parpadeo ni script previo al pintado, y la vista embebida en U-Cursos, que no tiene navegación, hereda la elección por el mismo acceso a almacenamiento que ya usa para la sesión.

Los colores de Tipo de nodo siguen guardándose como el hex elegido por el equipo docente. En oscuro se pintan con una variante más clara por cada color de la paleta; un color guardado fuera de la paleta se aclara por mezcla. Estas doce variantes son la única excepción a esa regla: son datos elegidos por docentes, y el kit no tiene doce tonos distinguibles y legibles sobre una superficie oscura.

## Consecuencias

- Cada color nuevo debe definirse en ambos temas en `globals.css`, y su valor oscuro debe ser un rol o un tono de la paleta del kit; los valores fijos en componentes rompen el tema oscuro.
- La variante `dark:` de Tailwind depende de `data-theme`, no de `prefers-color-scheme`.
- La extensión de U-Cursos no cambia. Que el Roadmap embebido siga el tema de U-Cursos en vez de la elección en U-Roadmaps requeriría que la extensión pase el tema al iframe.
- Agregar un color a la paleta de Tipos de nodo exige definir también su variante oscura.
- Las bandas de marca de la landing (`brand-surface`) son la excepción a la distribución: usan `--dcc-bg` (`#11161e`), más oscuro que la página y distinto de la navegación, para que sigan leyéndose como bandas.
