import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { handleApplicationResult, parseJsonObject } from '@/app/_adapters/http';
import { isPracticeExperience, recordPracticeRoadmapOpened } from '@/features/roadmap/server';
import { ApplicationError } from '@/shared/errors/server';

/** Records that the User opened a Roadmap tutorial on the Practice roadmap. */
export async function POST(request: Request) {
  return handleApplicationResult(async () => {
    const user = await requireAuthenticatedUser();
    const { experience } = await parseJsonObject(request);
    if (!isPracticeExperience(experience))
      throw new ApplicationError(400, 'INVALID_REQUEST', 'Experiencia desconocida.');
    await recordPracticeRoadmapOpened(user.id, experience);
    return new Response(null, { status: 204 });
  });
}
