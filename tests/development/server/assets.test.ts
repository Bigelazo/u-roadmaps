import { describe, expect, it } from 'vitest';
import { fixtureFileAssets, type FileFormat } from '@/development/fixtures/catalog';
import { developmentFixtureFileContents } from '@/development/server/assets';

const assertFileStructure: Record<FileFormat, (bytes: Buffer) => void> = {
  PDF: (bytes) => {
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.toString().endsWith('%%EOF\n')).toBe(true);
  },
  MARKDOWN: (bytes) => {
    expect(bytes.toString()).toContain('Recurso de desarrollo de U-Roadmaps.');
  },
  DOCX: (bytes) => {
    expect(bytes.subarray(0, 4).toString('hex')).toBe('504b0304');
    expect(bytes.subarray(-22, -18).toString('hex')).toBe('504b0506');
  },
  XLSX: (bytes) => {
    expect(bytes.subarray(0, 4).toString('hex')).toBe('504b0304');
    expect(bytes.subarray(-22, -18).toString('hex')).toBe('504b0506');
  },
  PPTX: (bytes) => {
    expect(bytes.subarray(0, 4).toString('hex')).toBe('504b0304');
    expect(bytes.subarray(-22, -18).toString('hex')).toBe('504b0506');
  },
};

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
      if (bytes) assertFileStructure[asset.format](bytes);
    }
  });
});
