import { describe, expect, test } from 'vitest';
import { deriveCanvasMode } from '@/features/roadmap/canvas/mode';

describe('deriveCanvasMode', () => {
  test('derives the ordinary student experience when no teaching capability is granted', () => {
    const mode = deriveCanvasMode({ experience: { kind: 'student', term: 'current' } });

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
    const mode = deriveCanvasMode({ experience: { kind: 'teaching', term: 'historical' } });

    expect(mode.isReadOnlyTeaching).toBe(true);
    expect(mode.isStudentExperience).toBe(false);
    expect(mode.capabilities.canPreviewCanvas).toBe(true);
    expect(mode.capabilities.canEnterCanvasPreview).toBe(true);
  });

  test('makes Canvas preview a student experience without losing historical restrictions', () => {
    const mode = deriveCanvasMode({
      experience: { kind: 'teaching', term: 'historical' },
      isCanvasPreview: true,
    });

    expect(mode).toEqual({
      isEditing: false,
      isReadOnlyTeaching: true,
      isStudentExperience: true,
      isHistorical: true,
      isCanvasPreview: true,
      capabilities: {
        canEditRoadmap: false,
        canPreviewCanvas: true,
        canEnterCanvasPreview: false,
        canResetCanvasPreview: false,
      },
    });
  });
});
