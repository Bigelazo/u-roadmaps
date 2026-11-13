import { handleApplicationResult, parseJsonObject } from '@/app/_adapters/http';
import { parseProblemReport, sendProblemReport } from '@/app/_adapters/problem-report';

export async function POST(request: Request) {
  return handleApplicationResult(async () => {
    const report = parseProblemReport(await parseJsonObject(request));
    await sendProblemReport(report);
    return Response.json({ sent: true }, { status: 201 });
  });
}
