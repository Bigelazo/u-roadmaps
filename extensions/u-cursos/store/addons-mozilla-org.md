# addons.mozilla.org (AMO): datos para el envío

Los textos de la ficha (nombre, resumen, descripción, categorías, imágenes)
están en [`listing.md`](listing.md). En AMO el resumen admite 250 caracteres; se
usa el mismo texto que la descripción corta.

## Distribución

**En este sitio** (_On this site_), para que la extensión aparezca en AMO y se
actualice automáticamente.

## ¿Código fuente?

**No.** El paquete contiene los archivos tal como están en
`extensions/u-cursos/`: no hay compilación, transpilación, concatenación ni
minificación, así que AMO no requiere subir código fuente aparte.

## `data_collection_permissions`

El manifiesto declara:

```json
"data_collection_permissions": { "required": ["none"] }
```

Motivo: la extensión no recopila, guarda ni transmite datos personales a
terceros. Lo único que sale de la página es el código, año y semestre del curso
abierto, que se envían a U-Roadmaps (el servicio del mismo equipo que publica
la extensión y al que el usuario ingresa con su propia cuenta) para obtener el
roadmap y el número de notificaciones sin leer de ese curso. No hay analítica,
publicidad, identificadores propios ni almacenamiento local.

Si la revisión considera que el curso abierto es «actividad de navegación», la
alternativa es declarar
`"required": ["browsingActivity"]`, que admite consentimiento implícito al
instalar (no requiere cambios de código, solo del manifiesto y una nueva
versión).

`strict_min_version` es 140.0 (escritorio) y 142.0 (Android) porque son las
primeras versiones que entienden `data_collection_permissions`, que AMO exige a
las extensiones nuevas.

## Notas para la revisión (_Notes to Reviewer_)

En inglés, porque el equipo de revisión no necesariamente lee español:

> Test page (public, no login needed):
> https://www.u-cursos.cl/ingenieria/2026/2/CC5003/1/datos_curso/
>
> The content script adds a "U-Roadmaps" item to the course's service list
> (left sidebar). Clicking it sets `#u-roadmaps`, hides the U-Cursos service
> content and shows an iframe to
> https://roadmap.dcc.uchile.cl/embed/courses/CC5003/2026/2. Going back
> restores the page.
>
> Seeing an actual roadmap and the unread-notification badge requires a
> U-Roadmaps account (sign-in through U-Pasaporte, the Universidad de Chile
> identity provider). Without a session the iframe shows a sign-in screen and
> no badge is shown; that is expected.
>
> The background script (`background.js`) only fetches
> `https://roadmap.dcc.uchile.cl/api/<course>/<year>/<semester>/notifications/count`
> with the user's own cookies, after validating the sender and message. No
> build step, no minification, no remote code, no analytics.
>
> The manifest declares both `background.service_worker` (used by Chrome) and
> `background.scripts` (used by Firefox) so one package works in both
> browsers; web-ext lint warns `BACKGROUND_SERVICE_WORKER_IGNORED`, which is
> expected.

## Política de privacidad

Pegar el contenido de [`privacy-policy.md`](privacy-policy.md) en el campo de
política de privacidad de AMO, o enlazar su URL pública.
