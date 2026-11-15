import type { ResourceInput } from './types';

type Mode = 'file' | 'link';
export type StagedResourceComposer = { mode: Mode; value: ResourceInput; file: File | null };

export const STAGED_RESOURCE_COMPOSER_ID = 'new-node-resource';

export const emptyComposer = (mode: Mode): StagedResourceComposer => ({
  mode,
  value: { title: '', url: '', type: 'LINK' },
  file: null,
});

export function composerHasContent(composer: StagedResourceComposer | null) {
  return Boolean(composer && (composer.file || composer.value.title || composer.value.url));
}
