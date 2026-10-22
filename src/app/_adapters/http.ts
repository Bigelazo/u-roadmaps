import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import type { CourseOfferingIdentifier, CourseOfferingIdentifierParams } from '@/features/roadmap';
import { ApplicationError, applicationResult } from '@/shared/errors/server';

type JsonObject = Record<string, unknown>;

export function applicationErrorResponse(error: ApplicationError): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    { status: error.status },
  );
}

export function handleApplicationResult<Success extends Response>(
  operation: () => Promise<Success>,
  onError: (error: ApplicationError) => Response = applicationErrorResponse,
): Promise<Response> {
  return applicationResult(operation).match(
    (response) => response,
    (error) => onError(error),
  );
}

export async function parseJsonObject(request: Request): Promise<JsonObject> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApplicationError(400, 'INVALID_JSON', 'El cuerpo debe ser JSON válido.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApplicationError(400, 'INVALID_REQUEST', 'El cuerpo debe ser un objeto JSON.');
  }
  return body as JsonObject;
}

type AuthenticatedUser = Awaited<ReturnType<typeof requireAuthenticatedUser>>;
type RouteParams = Readonly<Record<string, string>>;
type RouteContext = { params: Promise<RouteParams> };

export function authenticatedJson<Context = unknown>(
  read: (user: AuthenticatedUser, request: Request, context: Context) => Promise<unknown>,
) {
  return (request: Request, context?: Context) =>
    handleApplicationResult(async () => {
      const user = await requireAuthenticatedUser();
      return Response.json(await read(user, request, context as Context));
    });
}

type CourseRouteOptions<Identifier, Prepared, WithBody extends boolean> = {
  prepare?: (request: Request) => Prepared | Promise<Prepared>;
  identify?: (params: RouteParams) => Identifier;
  body?: WithBody;
  authWithParams?: boolean;
};

type CourseRouteInput<Identifier, Prepared, WithBody extends boolean> = {
  request: Request;
  params: RouteParams;
  identifier: Identifier;
  user: AuthenticatedUser;
  prepared: Prepared;
  body: WithBody extends true ? JsonObject : undefined;
};

export function courseRoute<
  Prepared = undefined,
  WithBody extends boolean = false,
  Identifier = CourseOfferingIdentifier,
>(
  handle: (input: CourseRouteInput<Identifier, Prepared, WithBody>) => Promise<Response>,
  options: CourseRouteOptions<Identifier, Prepared, WithBody> = {},
) {
  const identify =
    options.identify ??
    ((params: RouteParams) =>
      requireCourseOfferingIdentifier(params as CourseOfferingIdentifierParams) as Identifier);
  const parseBody = (request: Request) => (options.body ? parseJsonObject(request) : undefined);
  return (request: Request, context: RouteContext) =>
    handleApplicationResult(async () => {
      const prepared = (options.prepare ? await options.prepare(request) : undefined) as Prepared;
      let params: RouteParams;
      let identifier: Identifier;
      let body: JsonObject | undefined;
      let user: AuthenticatedUser;
      if (options.authWithParams) {
        [params, body, user] = await Promise.all([
          context.params,
          parseBody(request),
          requireAuthenticatedUser(),
        ]);
        identifier = identify(params);
      } else {
        params = await context.params;
        identifier = identify(params);
        [body, user] = await Promise.all([parseBody(request), requireAuthenticatedUser()]);
      }
      return handle({
        request,
        params,
        identifier,
        user,
        prepared,
        body: body as CourseRouteInput<Identifier, Prepared, WithBody>['body'],
      });
    });
}
