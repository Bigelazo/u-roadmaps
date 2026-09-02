import 'server-only';

// El servidor `standalone` escucha en `HOSTNAME`/`PORT` detrás de un proxy, de
// modo que `request.url` apunta al origen interno (`0.0.0.0:5210`). Las
// redirecciones y la comprobación de origen deben usar el origen público:
// primero `NEXTAUTH_URL`, luego las cabeceras del proxy y, como último recurso,
// la URL de la petición.
function configuredOrigin(): URL | null {
  const value = process.env.NEXTAUTH_URL;
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function firstHeaderValue(value: string | null) {
  return value?.split(',')[0]?.trim() || null;
}

function forwardedOrigin(request: Request): URL | null {
  const host = firstHeaderValue(
    request.headers.get('x-forwarded-host') ?? request.headers.get('host'),
  );
  if (!host) return null;
  const protocol =
    firstHeaderValue(request.headers.get('x-forwarded-proto')) ??
    new URL(request.url).protocol.replace(':', '');
  try {
    return new URL(`${protocol}://${host}`);
  } catch {
    return null;
  }
}

// El proxy termina TLS, así que un `NEXTAUTH_URL` con esquema `http` degradaría
// las cookies de sesión y haría fallar la comprobación de origen contra la
// cabecera `Origin`, que el navegador envía como `https`.
function upgradedToProxyProtocol(origin: URL, request: Request): URL {
  if (
    origin.protocol === 'http:' &&
    firstHeaderValue(request.headers.get('x-forwarded-proto')) === 'https'
  )
    origin.protocol = 'https:';
  return origin;
}

export function siteOrigin(request: Request): URL {
  return upgradedToProxyProtocol(
    configuredOrigin() ?? forwardedOrigin(request) ?? new URL(request.url),
    request,
  );
}

export function siteUrl(path: string, request: Request): URL {
  return new URL(path, siteOrigin(request));
}

export function isHttps(request: Request) {
  return siteOrigin(request).protocol === 'https:';
}
