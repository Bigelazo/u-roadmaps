# Ficha de la extensión (común a ambas tiendas)

## Nombre

U-Roadmaps en U-Cursos

## Descripción corta

Chrome Web Store (máx. 132 caracteres; Chrome la toma de `description` en
`manifest.json`) y resumen de AMO (máx. 250):

> Abre el roadmap de U-Roadmaps de cada curso dentro de U-Cursos y muestra cuántas notificaciones del curso tienes sin leer.

(122 caracteres.)

## Descripción larga

> U-Roadmaps en U-Cursos lleva el roadmap de cada curso de la Universidad de
> Chile a donde ya trabajas: la página del curso en U-Cursos.
>
> Qué hace:
>
> - Agrega el servicio «U-Roadmaps» a la barra de servicios de cada curso en
>   U-Cursos, junto a Material Docente.
> - Al abrirlo, muestra el roadmap del curso (U-Roadmaps,
>   roadmap.dcc.uchile.cl) dentro de la misma página, sin cambiar de pestaña.
>   Al volver atrás, U-Cursos queda tal como estaba.
> - Si tienes notificaciones sin leer de ese curso en U-Roadmaps, el ícono las
>   muestra con un contador.
>
> Requisitos:
>
> - Una cuenta de U-Roadmaps; se ingresa con U-Pasaporte. Sin sesión, el
>   servicio te guía para ingresar y el contador no se muestra.
>
> Privacidad:
>
> - La extensión no recopila, guarda ni comparte datos. Solo lee el curso de la
>   dirección de la página de U-Cursos (código, año y semestre) para pedirle a
>   U-Roadmaps el roadmap y el número de notificaciones sin leer, usando tu
>   propia sesión de U-Roadmaps.
> - No tiene analítica, publicidad ni código remoto.
>
> U-Roadmaps es un proyecto del Departamento de Ciencias de la Computación de la
> Universidad de Chile. U-Cursos es un servicio independiente; esta extensión
> no está afiliada a él.

## Categoría sugerida

- **Chrome Web Store:** Productividad → Educación.
- **addons.mozilla.org:** Otros (_Other_). Opcional como segunda categoría:
  Alertas y actualizaciones (_Alerts & Updates_), por el contador de
  notificaciones.

## Idioma

Español (Latinoamérica / `es-419`). La extensión no está traducida.

## Sitio y soporte

- Sitio: <https://roadmap.dcc.uchile.cl>
- Política de privacidad: publicar `privacy-policy.md` en una URL pública
  (por ejemplo `https://roadmap.dcc.uchile.cl/privacidad/extension` o el
  repositorio público) y usar esa URL en ambas tiendas.
- Correo de soporte: el de la cuenta de desarrollador del equipo.

## Imágenes

Generadas con `pnpm extension:screenshots` en `store/screenshots/`:

| Archivo                              | Tamaño   | Uso                                           |
| ------------------------------------ | -------- | --------------------------------------------- |
| `01-servicio-con-notificaciones.png` | 1280×800 | Captura: servicio en U-Cursos con contador    |
| `02-roadmap-embebido-conexion.png`   | 1280×800 | Captura: vista embebida (pantalla de ingreso) |
| `promocional-440x280.png`            | 440×280  | Mosaico promocional pequeño (solo Chrome)     |
| `../icons/network-128.png`           | 128×128  | Ícono de la tienda                            |

En ambas capturas el contador (3) es simulado, y en la segunda el contenido del
iframe es una maqueta de la pantalla de ingreso de U-Roadmaps, porque
`/embed` aún no está en producción. Cuando lo esté, conviene regenerar la
segunda captura con una sesión real que muestre un roadmap.
