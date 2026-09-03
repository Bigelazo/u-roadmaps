import { Position } from '@xyflow/react';

export type NodeRect = { x: number; y: number; width: number; height: number };
export type Point = { x: number; y: number };

/** Tamaño, en píxeles del lienzo, de cada celda del roadmap. */
export const roadmapGridSize = 20;

/**
 * Tamaño mínimo de una tarjeta, expresado en celdas completas del roadmap.
 * El área útil para el título empieza después del icono y los espacios laterales.
 */
export const roadmapNodeMinimumSize = {
  width: roadmapGridSize * 8,
  height: roadmapGridSize * 6,
} as const;

const roadmapNodeMaximumWidth = roadmapGridSize * 18;
const roadmapNodeDimensionStep = roadmapGridSize * 2;
const titleHorizontalChrome = 78;
const estimatedTitleCharacterWidth = 8.3;

function roundUpToRoadmapNodeStep(value: number) {
  return Math.ceil(value / roadmapNodeDimensionStep) * roadmapNodeDimensionStep;
}

/**
 * Calcula un rectángulo que se adapta al título sin abandonar la cuadrícula.
 * Los títulos cortos no desperdician espacio; al llegar al ancho máximo, las
 * líneas adicionales aumentan la altura dos celdas cada una, conservando los
 * conectores centrados en intersecciones de la cuadrícula.
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
  const height = roadmapNodeMinimumSize.height + (titleLines - 1) * roadmapNodeDimensionStep;

  return { width, height };
}

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
