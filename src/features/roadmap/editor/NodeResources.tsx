import { Plus } from 'lucide-react';
import type { Resource } from '@/features/roadmap/types';
import { Button } from '@/shared/ui/button';
import { useNodeEditorContext } from './context';
import { ResourceComposer } from './ResourceComposer';
import { ResourceList } from './ResourceList';

function composerMode(
  session: ReturnType<typeof useNodeEditorContext>['resourceSession'],
): 'file' | 'link' {
  if (session.kind === 'adding-link') return 'link';
  if (session.kind === 'editing-existing' && session.value.type !== 'FILE') return 'link';
  return 'file';
}

export function NodeResources() {
  const {
    node,
    resourceSession,
    openResource,
    closeResource,
    changeResourceMode,
    editResource,
    requestResourceDeletion,
  } = useNodeEditorContext();
  const isComposerOpen = resourceSession.kind !== 'closed';

  return (
    <section className="border-t border-border pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.12em] text-primary uppercase">
            Material de apoyo
          </p>
          <h3 className="mt-0.5 font-heading text-lg font-semibold tracking-[-0.02em]">
            Recursos <span className="text-muted-foreground">({node.resources.length})</span>
          </h3>
        </div>
        {!isComposerOpen && (
          <Button type="button" size="sm" onClick={() => openResource('file')}>
            <Plus data-icon="inline-start" />
            Recurso
          </Button>
        )}
      </div>
      <div className="pt-4 pb-6">
        {isComposerOpen && (
          <ResourceComposer
            mode={composerMode(resourceSession)}
            editingResource={
              resourceSession.kind === 'editing-existing'
                ? (node.resources.find((resource) => resource.id === resourceSession.resourceId) ??
                  null)
                : null
            }
            onClose={closeResource}
            onModeChange={changeResourceMode}
          />
        )}
        <ResourceList
          resources={node.resources}
          onEdit={(resource: Resource) => editResource(resource)}
          onDelete={requestResourceDeletion}
        />
      </div>
    </section>
  );
}
