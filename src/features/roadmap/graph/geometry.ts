import { Position } from '@xyflow/react';

export type NodeRect = { x: number; y: number; width: number; height: number };
export type Point = { x: number; y: number };

/** Tamaño, en píxeles del lienzo, de cada celda del roadmap. */
export const roadmapGridSize = 20;
const roadmapNodeSeparation = roadmapGridSize;

/**
 * Tamaño mínimo de una tarjeta, expresado en celdas completas del roadmap.
 * El área útil para el título empieza después del icono y los espacios laterales.
 */
export const roadmapNodeMinimumSize = {
  width: roadmapGridSize * 8,
  height: roadmapGridSize * 4,
} as const;

const roadmapNodeMaximumWidth = roadmapGridSize * 12;
const roadmapNodeDimensionStep = roadmapGridSize * 2;
const titleHorizontalChrome = 78;
const estimatedTitleCharacterWidth = 8.3;

function roundUpToRoadmapNodeStep(value: number) {
  return Math.ceil(value / roadmapNodeDimensionStep) * roadmapNodeDimensionStep;
}

/**
 * Calcula un rectángulo que se adapta al título sin abandonar la cuadrícula.
 * Los títulos cortos no desperdician espacio; al llegar al ancho máximo,
 * Las dos primeras líneas comparten la altura mínima. Cada par posterior suma
 * dos celdas, conservando los conectores centrados en intersecciones de la
 * cuadrícula sin dejar márgenes verticales desproporcionados.
 */
export function roadmapNodeSizeForTitle(title: string) {
  const characterCount = Math.max(Array.from(title.trim()).length, 1);
  const width = Math.min(
    roadmapNodeMaximumWidth,
    Math.max(
      roadmapNodeMinimumSize.width,
      roundUpToRoadmapNodeStep(
        titleHorizontalChrome + characterCount * estimatedTitleCharacterWidth,
      ),
    ),
  );
  const charactersPerLine = Math.max(
    1,
    Math.floor((width - titleHorizontalChrome) / estimatedTitleCharacterWidth),
  );
  const titleLines = Math.ceil(characterCount / charactersPerLine);
  const height =
    roadmapNodeMinimumSize.height +
    Math.ceil(Math.max(titleLines - 2, 0) / 2) * roadmapNodeDimensionStep;

  return { width, height };
}

/** Ajusta una posición a la intersección más cercana de la cuadrícula del roadmap. */
export function snapToRoadmapGrid(position: Point): Point {
  return {
    x: Math.round(position.x / roadmapGridSize) * roadmapGridSize,
    y: Math.round(position.y / roadmapGridSize) * roadmapGridSize,
  };
}

function hasRoomForNode(candidate: NodeRect, occupied: readonly NodeRect[]) {
  return occupied.every(
    (rect) =>
      candidate.x + candidate.width + roadmapNodeSeparation <= rect.x ||
      rect.x + rect.width + roadmapNodeSeparation <= candidate.x ||
      candidate.y + candidate.height + roadmapNodeSeparation <= rect.y ||
      rect.y + rect.height + roadmapNodeSeparation <= candidate.y,
  );
}

function fitsWithinViewport(candidate: NodeRect, viewport: NodeRect) {
  return (
    candidate.x >= viewport.x &&
    candidate.y >= viewport.y &&
    candidate.x + candidate.width <= viewport.x + viewport.width &&
    candidate.y + candidate.height <= viewport.y + viewport.height
  );
}

function positionsAtDistance(distance: number) {
  if (distance === 0) return [{ x: 0, y: 0 }];

  const positions: Point[] = [
    { x: 0, y: -distance },
    { x: distance, y: 0 },
    { x: 0, y: distance },
    { x: -distance, y: 0 },
  ];
  for (let coordinate = -distance; coordinate <= distance; coordinate += roadmapGridSize) {
    for (const offset of [
      { x: coordinate, y: -distance },
      { x: distance, y: coordinate },
      { x: coordinate, y: distance },
      { x: -distance, y: coordinate },
    ]) {
      if (!positions.some((position) => position.x === offset.x && position.y === offset.y)) {
        positions.push(offset);
      }
    }
  }
  return positions;
}

/**
 * Encuentra la primera posición libre para una tarjeta alrededor del punto pedido.
 * Cada intento conserva la cuadrícula y deja una celda de separación entre tarjetas.
 */
export function findOpenRoadmapPosition(
  occupied: readonly NodeRect[],
  desired: Point,
  size: Pick<NodeRect, 'width' | 'height'>,
  viewport: NodeRect,
): Point | null {
  const origin = snapToRoadmapGrid(desired);
  const maxDistance = Math.max(viewport.width + size.width, viewport.height + size.height);

  for (let distance = 0; distance <= maxDistance; distance += roadmapGridSize) {
    for (const offset of positionsAtDistance(distance)) {
      const position = { x: origin.x + offset.x, y: origin.y + offset.y };
      const candidate = { ...position, ...size };
      if (fitsWithinViewport(candidate, viewport) && hasRoomForNode(candidate, occupied)) {
        return position;
      }
    }
  }
  return null;
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
