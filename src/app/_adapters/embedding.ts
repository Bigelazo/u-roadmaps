const framedDestinations: ReadonlySet<string> = new Set(['iframe', 'frame']);

export function isFramedRequest(requestHeaders: Pick<Headers, 'get'>): boolean {
  return framedDestinations.has(requestHeaders.get('sec-fetch-dest') ?? '');
}
