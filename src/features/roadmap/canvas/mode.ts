import type { RoadmapCanvasExperience } from '@/features/roadmap/session/types';

export type CanvasModeInput = {
  experience: RoadmapCanvasExperience;
  isCanvasPreview?: boolean;
};

export type CanvasCapabilities = {
  canEditRoadmap: boolean;
  canPreviewCanvas: boolean;
  canEnterCanvasPreview: boolean;
  canResetCanvasPreview: boolean;
};

export type CanvasMode = {
  isEditing: boolean;
  isReadOnlyTeaching: boolean;
  isStudentExperience: boolean;
  isHistorical: boolean;
  isCanvasPreview: boolean;
  capabilities: CanvasCapabilities;
};

export function deriveCanvasMode({ experience, isCanvasPreview = false }: CanvasModeInput): CanvasMode {
  const isTeaching = experience.kind === 'teaching';
  const isHistorical = experience.term === 'historical';
  const canEdit = isTeaching && !isHistorical;
  const isReadOnlyTeaching = isTeaching && isHistorical;
  const isStudentExperience = !isTeaching || isCanvasPreview;

  return {
    isEditing: canEdit && !isCanvasPreview,
    isReadOnlyTeaching,
    isStudentExperience,
    isHistorical,
    isCanvasPreview,
    capabilities: {
      canEditRoadmap: canEdit,
      canPreviewCanvas: isTeaching,
      canEnterCanvasPreview: isTeaching && !isCanvasPreview,
      canResetCanvasPreview: isCanvasPreview && !isHistorical,
    },
  };
}
