import { randomUUID } from 'node:crypto';
import { insert, sql } from './database';

/** Prepare a visible Node without emitting notices or opening a delivery window. */
export async function createExistingNode(input: {
  roadmapId: string;
  nodeTypeId: string;
  title: string;
  description?: string;
  positionX?: number;
  positionY?: number;
}) {
  const id = randomUUID();
  await sql(
    insert('RoadmapNode', [
      {
        id,
        ...input,
        description: input.description ?? '',
        positionX: input.positionX ?? 0,
        positionY: input.positionY ?? 0,
        isVisible: true,
        isTeacherBlocked: false,
      },
    ]),
  );
  return id;
}
