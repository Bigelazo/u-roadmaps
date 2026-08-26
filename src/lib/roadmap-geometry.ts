import { Position } from 'reactflow';

export type NodeRect = { x: number; y: number; width: number; height: number };
export type Point = { x: number; y: number };

/** Tamaño, en píxeles del lienzo, de cada celda del roadmap. */
export const roadmapGridSize = 20;

/** Ajusta una posición a la intersección más cercana de la cuadrícula del roadmap. */
export function snapToRoadmapGrid(position: Point): Point {
  return {
    x: Math.round(position.x / roadmapGridSize) * roadmapGridSize,
    y: Math.round(position.y / roadmapGridSize) * roadmapGridSize,
  };
}

export function nodeCenter(rect: NodeRect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/**
 * Elige el lado por el que una arista abandona `from` en dirección a `to`.
 * Domina el eje con mayor separación entre centros: usar arriba o abajo cuando
 * la distancia horizontal es la grande deja la arista sin espacio para trazarse.
 */
export function nearestSide(from: Point, to: Point): Position {
  const horizontal = Math.abs(from.x - to.x);
  const vertical = Math.abs(from.y - to.y);
  if (horizontal > vertical) return from.x > to.x ? Position.Left : Position.Right;
  return from.y > to.y ? Position.Top : Position.Bottom;
}

/** Punto medio del lado indicado, que es donde queda centrado su conector. */
export function sideAnchor(rect: NodeRect, side: Position): Point {
  switch (side) {
    case Position.Top:
      return { x: rect.x + rect.width / 2, y: rect.y };
    case Position.Bottom:
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    case Position.Left:
      return { x: rect.x, y: rect.y + rect.height / 2 };
    case Position.Right:
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
  }
}

export function floatingEdgeGeometry(source: NodeRect, target: NodeRect) {
  const sourceCenter = nodeCenter(source);
  const targetCenter = nodeCenter(target);
  const sourcePosition = nearestSide(sourceCenter, targetCenter);
  const targetPosition = nearestSide(targetCenter, sourceCenter);
  const sourceAnchor = sideAnchor(source, sourcePosition);
  const targetAnchor = sideAnchor(target, targetPosition);
  return {
    sourceX: sourceAnchor.x,
    sourceY: sourceAnchor.y,
    sourcePosition,
    targetX: targetAnchor.x,
    targetY: targetAnchor.y,
    targetPosition,
  };
}
