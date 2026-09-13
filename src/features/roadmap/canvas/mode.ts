export type CanvasModeInput = {
  canEdit?: boolean;
  canPreview?: boolean;
  isHistorical?: boolean;
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

export function deriveCanvasMode({
  canEdit = false,
  canPreview = canEdit,
  isHistorical = false,
  isCanvasPreview = false,
}: CanvasModeInput): CanvasMode {
  const isReadOnlyTeaching = canPreview && !canEdit;
  const isStudentExperience = (!canEdit && !isReadOnlyTeaching) || isCanvasPreview;

  return {
    isEditing: canEdit && !isCanvasPreview,
    isReadOnlyTeaching,
    isStudentExperience,
    isHistorical,
    isCanvasPreview,
    capabilities: {
      canEditRoadmap: canEdit,
      canPreviewCanvas: canPreview,
      canEnterCanvasPreview: canPreview && !isCanvasPreview,
      canResetCanvasPreview: isCanvasPreview && !isHistorical,
    },
  };
}
