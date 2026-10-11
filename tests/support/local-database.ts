const localHosts = ['localhost', '127.0.0.1', '[::1]'];

/** Whether a connection URL names the given database on this machine. */
export function isLocalDatabase(url: URL, database: string) {
  return localHosts.includes(url.hostname) && url.pathname === `/${database}`;
}
