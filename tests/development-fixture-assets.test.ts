import { describe, expect, it } from 'vitest';
import { developmentFixtureFileContents } from '@/lib/development-fixture-assets';
import { fixtureFileAssets } from '@/lib/development-fixtures';

describe('development fixture files', () => {
  it('creates non-empty, structurally recognizable files for every supported format', () => {
    const bytesByKey = new Map(
      developmentFixtureFileContents().map(({ fileKey, bytes }) => [fileKey, bytes]),
    );

    expect(new Set(fixtureFileAssets.map(({ format }) => format))).toEqual(
      new Set(['PDF', 'MARKDOWN', 'DOCX', 'XLSX', 'PPTX']),
    );
    for (const asset of fixtureFileAssets) {
      const bytes = bytesByKey.get(asset.fileKey);
      expect(bytes?.byteLength).toBeGreaterThan(0);
      if (asset.format === 'PDF') {
        expect(bytes?.subarray(0, 5).toString()).toBe('%PDF-');
        expect(bytes?.toString().endsWith('%%EOF\n')).toBe(true);
      } else if (asset.format === 'MARKDOWN') {
        expect(bytes?.toString()).toContain('Recurso de desarrollo de U-Roadmaps.');
      } else {
        expect(bytes?.subarray(0, 4).toString('hex')).toBe('504b0304');
        expect(bytes?.subarray(-22, -18).toString('hex')).toBe('504b0506');
      }
    }
  });
});
