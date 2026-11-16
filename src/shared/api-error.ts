export type ApiErrorBody = { readonly message: string; readonly code?: unknown };

export async function readApiErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'message' in body.error &&
      typeof body.error.message === 'string'
    )
      return {
        message: body.error.message,
        code: 'code' in body.error ? body.error.code : undefined,
      };
    // eslint-disable-next-line no-empty -- A response without a JSON error body has no message to read.
  } catch {}
  return null;
}
