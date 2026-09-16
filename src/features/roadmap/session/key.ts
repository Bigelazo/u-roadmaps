import type { RoadmapCanvasSessionInput } from '@/features/roadmap/session/types';

export function roadmapCanvasSessionKey(input: RoadmapCanvasSessionInput) {
  const { courseCode, year, semester } = input.courseOffering.identifier;
  return `${courseCode}:${year}:${semester}:${input.experience.kind}:${input.experience.term}`;
}
