import { Plus, X } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import { Item, ItemMedia } from '@/shared/ui/item';
import { uploadedContentType } from '@/features/roadmap/domain/resource';
import { ResourceIcon } from '@/features/roadmap/ui/ResourceIcon';
import { ResourceMetadata } from '@/features/roadmap/ui/ResourceMetadata';
import { dividedItemClassName } from './primitives';
import { ResourceComposerForm } from './ResourceComposer';
import { stagedResourceTitle, type ResourceInput, type StagedResource } from './types';

type Mode = 'file' | 'link';
type Composer = { mode: Mode; value: ResourceInput; file: File | null };

export const STAGED_RESOURCE_COMPOSER_ID = 'new-node-resource';

const emptyComposer = (mode: Mode): Composer => ({
  mode,
  value: { title: '', url: '', type: 'LINK' },
  file: null,
});

export function composerHasContent(composer: Composer | null) {
  return Boolean(composer && (composer.file || composer.value.title || composer.value.url));
}

function stagedResourceView(resource: StagedResource) {
  return resource.type === 'FILE'
    ? {
        type: 'FILE' as const,
        title: resource.file.name,
        fileContentType: uploadedContentType(resource.file),
        fileSize: resource.file.size,
      }
    : { type: 'LINK' as const, title: resource.title, fileContentType: null, fileSize: null };
}

function linkHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function StagedResources({
  resources,
  composer,
  disabled,
  onComposerChange,
  onAdd,
  onRemove,
}: {
  resources: readonly StagedResource[];
  composer: Composer | null;
  disabled: boolean;
  onComposerChange: (composer: Composer | null) => void;
  onAdd: (resource: StagedResource) => void;
  onRemove: (resourceId: string) => void;
}) {
  return (
    <section aria-labelledby="new-node-resources-heading" className="flex flex-col gap-3">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h3 id="new-node-resources-heading" className="text-sm font-medium">
          Recursos{' '}
          <span className="font-normal text-muted-foreground tabular-nums">
            ({resources.length})
          </span>
        </h3>
        {!composer && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              onComposerChange(emptyComposer('file'));
              requestAnimationFrame(() =>
                document
                  .getElementById(`${STAGED_RESOURCE_COMPOSER_ID}-composer`)
                  ?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }),
              );
            }}
          >
            <Plus data-icon="inline-start" />
            Recurso
          </Button>
        )}
      </div>
      {composer ? (
        <ResourceComposerForm
          idPrefix={STAGED_RESOURCE_COMPOSER_ID}
          mode={composer.mode}
          editingResource={null}
          value={composer.value}
          selectedFile={composer.file}
          replacementFile={null}
          isPending={disabled}
          fileSubmitLabel="Agregar archivo"
          onModeChange={(mode) => onComposerChange({ ...composer, mode, file: null })}
          onClose={() => onComposerChange(null)}
          onValueChange={(value) => onComposerChange({ ...composer, value })}
          onSelectFile={(file) => onComposerChange({ ...composer, file })}
          onSave={() => {
            const id = crypto.randomUUID();
            if (composer.mode === 'file') {
              if (composer.file) onAdd({ id, type: 'FILE', file: composer.file });
            } else {
              onAdd({
                id,
                type: 'LINK',
                title: composer.value.title.trim(),
                url: composer.value.url.trim(),
              });
            }
            onComposerChange(null);
          }}
        />
      ) : null}
      {resources.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border" aria-label="Recursos por agregar">
          {resources.map((resource) => {
            const view = stagedResourceView(resource);
            const title = stagedResourceTitle(resource);
            return (
              <Item key={resource.id} render={<li />} className={cn(dividedItemClassName, 'gap-2')}>
                <ItemMedia className="text-primary">
                  <ResourceIcon resource={view} />
                </ItemMedia>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{title}</span>
                  {resource.type === 'FILE' ? (
                    <ResourceMetadata resource={view} className="mt-0.5" />
                  ) : (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {linkHost(resource.url)}
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`Quitar recurso ${title}`}
                  onClick={() => onRemove(resource.id)}
                >
                  <X />
                </Button>
              </Item>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

export type { Composer as StagedResourceComposer };
