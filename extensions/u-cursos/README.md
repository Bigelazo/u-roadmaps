# U-Roadmaps en U-Cursos

Extensión para Firefox y Chrome (Manifest V3, un solo `manifest.json`) que
agrega el servicio **U-Roadmaps** a la barra de servicios de cada curso en
U-Cursos, junto a Material Docente. Al abrirlo, el contenido del servicio
actual se reemplaza por el roadmap del curso, embebido desde
`https://roadmap.dcc.uchile.cl`. El ícono muestra cuántas notificaciones sin
leer tienes en ese curso.

## Archivos

| Archivo               | Qué es                                                                        |
| --------------------- | ----------------------------------------------------------------------------- |
| `manifest.json`       | Manifiesto compartido por Chrome y Firefox.                                   |
| `roadmap-service.js`  | Script de contenido en `https://www.u-cursos.cl/*`.                           |
| `roadmap-service.css` | Estilos del iframe y del contador.                                            |
| `background.js`       | Service worker (Chrome) / script de fondo (Firefox) que consulta el contador. |
| `icons/`              | Ícono «network» de Lucide en `#024ad8` (SVG y PNG 16/32/48/128).              |
| `store/`              | Textos, capturas y política de privacidad para las tiendas. No va en el zip.  |

## Cómo funciona

### Servicio y vista embebida

- `roadmap-service.js` se ejecuta en `https://www.u-cursos.cl/*`. En páginas de
  curso (`/<institución>/<año>/<semestre>/<código>/<sección>/<servicio>/`) agrega
  el ícono y escucha el fragmento `#u-roadmaps`; volver atrás restaura la página.
- El iframe abre `/embed/courses/<código>/<año>/<semestre>`. Con sesión,
  redirige a `/courses/...`; sin sesión, muestra cómo conectarse:
  - **Conectar** pide acceso a la sesión de U-Roadmaps con la Storage Access
    API (necesario en Firefox, que aísla las cookies de terceros).
  - **Ingresar con U-Pasaporte** abre el ingreso en una pestaña nueva; luego
    **Ya ingresé** recarga el iframe.
- U-Roadmaps solo acepta ser embebido por U-Cursos (`frame-ancestors`), y su
  cookie de sesión es `SameSite=None` sobre HTTPS. Las mutaciones de `/api`
  desde otros sitios se rechazan en `src/proxy.ts`.

### Contador de notificaciones

- En MV3 un script de contenido no puede hacer solicitudes con credenciales a
  otro origen, así que le envía a `background.js` el mensaje
  `{ type: 'u-roadmaps/unread-notification-count', offering }`.
- `background.js` lo acepta solo si viene de una pestaña de
  `https://www.u-cursos.cl` de esta misma extensión y si el curso es válido
  (código alfanumérico, año de 4 dígitos, semestre 1 o 2). Entonces consulta
  `GET https://roadmap.dcc.uchile.cl/api/<código>/<año>/<semestre>/notifications/count`
  con `credentials: 'include'` y responde `{ unread }`: un entero, o `null` si
  la respuesta no es `200 {"unread": n}` (por ejemplo, `401` sin sesión).
- El contador aparece sobre el ícono (`#024ad8`, `99+` sobre 99) y el nombre
  accesible del enlace pasa a ser «U-Roadmaps, 3 notificaciones sin leer». Con
  0 o sin dato el contador se oculta y el enlace vuelve a su nombre normal.
- Se actualiza al cargar la página, cada 60 s mientras la pestaña está
  visible, al volver a la pestaña y al salir de la vista de U-Roadmaps.
- `background.js` es lo único que hace solicitudes, y solo a
  `https://roadmap.dcc.uchile.cl` (`host_permissions`).

### ¿Llega la cookie de sesión a esa solicitud?

La cookie de U-Roadmaps es `SameSite=None; Secure`, así que `SameSite` no la
bloquea. Lo que importa es si el navegador la trata como cookie de terceros:

- **Chrome:** las solicitudes de una extensión a un sitio para el que tiene
  permiso de host se tratan como del mismo sitio, pero la documentación aclara
  que esto _no aplica si el usuario bloquea las cookies de terceros_. También
  dice que las cookies de terceros nunca se bloquean cuando la página
  principal de la pestaña es de la extensión
  ([Chrome: Storage and cookies, «Partitioning and SameSite behavior»](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies)).
  El service worker tiene como contexto el origen `chrome-extension://`, así
  que es esperable que la cookie se envíe incluso con el bloqueo activo, pero
  la documentación no lo dice explícitamente para el service worker. Si no se
  enviara, el contador simplemente no aparece (igual que con `401`).
- **Firefox:** la Protección total de cookies particiona el almacenamiento por
  sitio principal, pero las URL `moz-extension:` no pueden ser clave de
  partición. Por eso los documentos de la extensión, incluida la página de
  fondo, usan el almacenamiento sin particionar: el mismo que al visitar
  `roadmap.dcc.uchile.cl` directamente
  ([MDN: cookies, Storage partitioning](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies#storage_partitioning)).
  Además, el permiso de host permite que las páginas de la extensión
  esquiven la protección contra rastreo para ese sitio
  ([MDN: host_permissions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/host_permissions)).

Comprobado en Chromium (Playwright): la solicitud del service worker lleva la
cookie de `roadmap.dcc.uchile.cl`. No se logró activar el bloqueo de cookies de
terceros en Chromium headless para probar ese caso, y Firefox no se probó
automáticamente.

### Script de fondo en ambos navegadores

`background` declara `service_worker` y `scripts` con el mismo archivo. Chrome
121+ usa `service_worker` e ignora `scripts`; Firefox 121+ usa `scripts` como
página de eventos e ignora `service_worker`
([MDN: background, compatibilidad](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background#browser_support)).
Por eso `minimum_chrome_version` es 121. En Firefox el mínimo es 140 (142 en
Android), las primeras versiones que entienden `data_collection_permissions`.

## Cargar la extensión en desarrollo

- **Firefox:** `about:debugging#/runtime/this-firefox` → _Cargar complemento
  temporal…_ → elegir `manifest.json`.
- **Chrome:** `chrome://extensions` → activar _Modo de desarrollador_ →
  _Cargar descomprimida_ → elegir esta carpeta. Chrome advierte que no reconoce
  `browser_specific_settings`; esa clave es solo para Firefox.

## Revisar, empaquetar y capturar

```sh
pnpm extension:lint         # web-ext lint (Mozilla)
pnpm extension:package      # dist/extensions/u-roadmaps-u-cursos-<versión>.zip
pnpm extension:screenshots  # store/screenshots/*.png
```

- `extension:lint` debe terminar con 0 errores y una sola advertencia,
  `BACKGROUND_SERVICE_WORKER_IGNORED`: es la clave para Chrome descrita arriba.
- `extension:package` toma la versión de `manifest.json` y deja
  `manifest.json` en la raíz del zip. Incluye todo menos `README.md` y
  `store/`. El mismo zip sirve para ambas tiendas.
- `extension:screenshots` abre la página pública de un curso con la extensión
  cargada en Chromium. El contador (3) es simulado y el iframe muestra una
  maqueta de la pantalla de ingreso, porque `/embed` aún no está en producción.

## Publicar

Antes de cada versión: subir `version` en `manifest.json`, correr
`pnpm extension:lint` y `pnpm extension:package`, y probar el zip descomprimido
en ambos navegadores.

### Chrome Web Store

1. Crear la cuenta de desarrollador en
   <https://chrome.google.com/webstore/devconsole> (pago único de USD 5) con
   una cuenta del equipo, y verificar el correo de contacto.
2. _Nuevo elemento_ → subir `dist/extensions/u-roadmaps-u-cursos-<versión>.zip`.
3. **Ficha de Play Store** (_Store listing_), con
   [`store/listing.md`](store/listing.md): descripción larga, categoría
   (Productividad → Educación), idioma español, ícono `icons/network-128.png`,
   capturas `store/screenshots/01-…png` y `02-…png`, mosaico promocional
   pequeño `store/screenshots/promocional-440x280.png` y sitio web. La
   descripción corta sale de `description` en `manifest.json`.
4. **Prácticas de privacidad**, con
   [`store/chrome-web-store.md`](store/chrome-web-store.md): propósito único,
   justificación del permiso de host y del script de contenido, «no uso código
   remoto», ninguna categoría de datos, las tres certificaciones y la URL de la
   política de privacidad.
5. Publicar [`store/privacy-policy.md`](store/privacy-policy.md) en una URL
   pública y pegarla en el paso anterior.
6. **Distribución:** pública (o no listada para una prueba cerrada).
7. Pegar las instrucciones para la revisión de
   [`store/chrome-web-store.md`](store/chrome-web-store.md) en
   _Instrucciones de prueba_ y enviar a revisión.

### addons.mozilla.org

1. Crear la cuenta en <https://addons.mozilla.org/developers/> (gratis, con
   cuenta de Mozilla) y aceptar el acuerdo de distribución.
2. _Enviar un complemento nuevo_ → **En este sitio** → subir el mismo zip. El
   ID `u-roadmaps@dcc.uchile.cl` viene de `browser_specific_settings.gecko`.
3. Plataformas: Firefox y Firefox para Android.
4. **¿Código fuente?: No.** No hay compilación ni minificación; el zip es el
   código fuente.
5. Ficha, con [`store/listing.md`](store/listing.md): nombre, resumen,
   descripción, categorías (Otros; opcional Alertas y actualizaciones), sitio,
   correo de soporte, licencia, ícono y capturas.
6. Política de privacidad: contenido o URL de
   [`store/privacy-policy.md`](store/privacy-policy.md).
7. _Notas para la revisión_: el texto de
   [`store/addons-mozilla-org.md`](store/addons-mozilla-org.md), que también
   explica la declaración de `data_collection_permissions`.
8. Enviar. AMO firma la extensión al aprobarla; las versiones nuevas se suben
   desde la página del complemento con el zip de la nueva versión.
