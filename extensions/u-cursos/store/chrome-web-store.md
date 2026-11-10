# Chrome Web Store: respuestas del panel de desarrollador

Los textos de la ficha (nombre, descripciones, categoría, imágenes) están en
[`listing.md`](listing.md).

## Pestaña «Prácticas de privacidad»

### Propósito único

> Mostrar, dentro de la página de cada curso en U-Cursos, el roadmap de ese
> curso en U-Roadmaps y la cantidad de notificaciones sin leer del curso.

### Justificación de permisos

La extensión no pide permisos de API (`permissions` está vacío). Solo declara
acceso a dos sitios:

| Acceso                                             | Justificación                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Script de contenido en `https://www.u-cursos.cl/*` | Agrega el servicio «U-Roadmaps» a la barra de servicios de las páginas de curso de U-Cursos y muestra el roadmap embebido. Las rutas de curso varían por institución, año, semestre, código, sección y servicio, por lo que se necesita todo el sitio; fuera de páginas de curso el script no hace nada. |
| Permiso de host `https://roadmap.dcc.uchile.cl/*`  | El service worker consulta `GET /api/<código>/<año>/<semestre>/notifications/count` en U-Roadmaps con la sesión del propio usuario, para mostrar el contador de notificaciones sin leer. Es el único origen al que la extensión hace solicitudes.                                                        |

### Código remoto

> **No, no uso código remoto.** Todo el JavaScript va en el paquete. La vista
> del roadmap es un `iframe` a la página web de U-Roadmaps, que se ejecuta como
> un sitio web normal y no con privilegios de la extensión.

### Uso de datos

Marcar **ninguna** categoría de datos («¿Qué datos del usuario recopilas?»):

| Categoría                              | ¿Se recopila? | Motivo                                                                                               |
| -------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| Información de identificación personal | No            |                                                                                                      |
| Información de salud                   | No            |                                                                                                      |
| Información financiera y de pago       | No            |                                                                                                      |
| Información de autenticación           | No            | La cookie de sesión de U-Roadmaps la envía el navegador; la extensión no la lee ni la guarda.        |
| Comunicaciones personales              | No            |                                                                                                      |
| Ubicación                              | No            |                                                                                                      |
| Historial web                          | No            | Solo se usa el código, año y semestre del curso abierto, y solo para pedirle sus datos a U-Roadmaps. |
| Actividad del usuario                  | No            |                                                                                                      |
| Contenido del sitio web                | No            |                                                                                                      |

Marcar las tres certificaciones:

- No vendo ni transfiero datos de usuarios a terceros, fuera de los casos de uso
  aprobados.
- No uso ni transfiero datos de usuarios para fines no relacionados con el
  propósito único de mi elemento.
- No uso ni transfiero datos de usuarios para determinar la solvencia
  crediticia ni para otorgar préstamos.

URL de la política de privacidad: la URL pública de
[`privacy-policy.md`](privacy-policy.md).

## Instrucciones para la revisión (_Test instructions_)

En inglés, porque el equipo de revisión no necesariamente lee español:

> Test page (public, no login needed):
> https://www.u-cursos.cl/ingenieria/2026/2/CC5003/1/datos_curso/
>
> A "U-Roadmaps" item with a network icon appears in the course's service list
> (left sidebar). Clicking it shows U-Roadmaps embedded in the page; without a
> session U-Roadmaps shows a sign-in screen. Going back restores the U-Cursos
> page.
>
> Seeing an actual roadmap and the unread-notification badge requires a
> U-Roadmaps account (sign-in through U-Pasaporte, the Universidad de Chile
> identity provider). Without a session no badge is shown; that is expected.
>
> The service worker (`background.js`) only requests
> https://roadmap.dcc.uchile.cl. No analytics, no remote code, no
> minification.

## Distribución

- Visibilidad: **Pública** (o _No listada_ mientras se prueba con un grupo).
- Regiones: todas (o solo Chile).
