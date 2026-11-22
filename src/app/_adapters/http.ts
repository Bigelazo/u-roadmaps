import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, synchronizeSessionParticipation } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import type {
  CourseOfferingIdentifier,
  CourseOfferingIdentifierParams,
} from '@/shared/course-offering';
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

type FileDownload = {
  readonly stream: ReadableStream<Uint8Array>;
  readonly size: number;
  readonly contentType: string;
  readonly title: string;
};

function dispositionType(request: Request, contentType: string) {
  const inline =
    new URL(request.url).searchParams.get('disposition') === 'inline' &&
    contentType.split(';')[0].trim().toLowerCase() === 'application/pdf';
  return inline ? 'inline' : 'attachment';
}

export function fileDownloadResponse(download: FileDownload, request: Request): NextResponse {
  return new NextResponse(download.stream, {
    headers: {
      'Content-Type': download.contentType,
      'Content-Length': String(download.size),
      'Content-Disposition': `${dispositionType(request, download.contentType)}; filename*=UTF-8''${encodeURIComponent(download.title)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function handleApplicationResult<Success extends Response>(
  operation: () => Promise<Success>,
): Promise<Response> {
  return applicationResult(operation).match((response) => response, applicationErrorResponse);
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

export async function parseFormData(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw new ApplicationError(400, 'INVALID_REQUEST', 'El archivo no puede superar los 10 MB.');
  }
}

const readMethods = new Set(['GET', 'HEAD']);

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
};

type CourseRouteInput<Identifier, Prepared, WithBody extends boolean> = {
  request: Request;
  params: RouteParams;
  identifier: Identifier;
  user: AuthenticatedUser;
  actor: { userId: string; identifier: Identifier };
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
      const [params, body, user] = await Promise.all([
        context.params,
        parseBody(request),
        requireAuthenticatedUser(),
      ]);
      const identifier = identify(params);
      if (!options.identify && !readMethods.has(request.method))
        await synchronizeSessionParticipation(identifier as CourseOfferingIdentifier);
      return handle({
        request,
        params,
        identifier,
        user,
        actor: { userId: user.id, identifier },
        prepared,
        body: body as CourseRouteInput<Identifier, Prepared, WithBody>['body'],
      });
    });
}
