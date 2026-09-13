import { describe, expect, test } from 'vitest';
import { deriveCanvasMode } from '@/features/roadmap/canvas/mode';

describe('deriveCanvasMode', () => {
  test('derives the ordinary student experience when no teaching capability is granted', () => {
    const mode = deriveCanvasMode({ canEdit: false, canPreview: false });

    expect(mode).toEqual({
      isEditing: false,
      isReadOnlyTeaching: false,
      isStudentExperience: true,
      isHistorical: false,
      isCanvasPreview: false,
      capabilities: {
        canEditRoadmap: false,
        canPreviewCanvas: false,
        canEnterCanvasPreview: false,
        canResetCanvasPreview: false,
      },
    });
  });

  test('derives read-only teaching separately from the student experience', () => {
    const mode = deriveCanvasMode({ canEdit: false, canPreview: true });

    expect(mode.isReadOnlyTeaching).toBe(true);
    expect(mode.isStudentExperience).toBe(false);
    expect(mode.capabilities.canPreviewCanvas).toBe(true);
    expect(mode.capabilities.canEnterCanvasPreview).toBe(true);
  });

  test('makes Canvas preview a student experience without losing historical restrictions', () => {
    const mode = deriveCanvasMode({
      canEdit: true,
      canPreview: true,
      isHistorical: true,
      isCanvasPreview: true,
    });

    expect(mode).toEqual({
      isEditing: false,
      isReadOnlyTeaching: false,
      isStudentExperience: true,
      isHistorical: true,
      isCanvasPreview: true,
      capabilities: {
        canEditRoadmap: true,
        canPreviewCanvas: true,
        canEnterCanvasPreview: false,
        canResetCanvasPreview: false,
      },
    });
  });
});
