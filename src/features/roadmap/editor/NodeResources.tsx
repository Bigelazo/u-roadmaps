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
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-heading text-base font-semibold">
          Recursos <span className="text-muted-foreground">({node.resources.length})</span>
        </h3>
        {!isComposerOpen && (
          <Button type="button" size="sm" variant="outline" onClick={() => openResource('file')}>
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
