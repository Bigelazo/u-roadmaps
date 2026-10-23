const localHosts = ['localhost', '127.0.0.1', '[::1]'];

export function isLocalDatabase(url: URL, database: string) {
  return localHosts.includes(url.hostname) && url.pathname === `/${database}`;
}
