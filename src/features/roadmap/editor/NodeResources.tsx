import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { Resource, RoadmapNode } from '@/lib/roadmap-types';
import { Button } from '@/components/ui/button';
import { ResourceComposer } from './ResourceComposer';
import { ResourceList } from './ResourceList';
import type { ResourceInput } from './types';

type Props = {
  node: RoadmapNode;
  resourceValue: ResourceInput;
  editingResourceId: string | null;
  onResourceChange: (value: ResourceInput) => void;
  onAddResource: (nodeId: string, resource: ResourceInput) => Promise<boolean>;
  onUploadResource: (nodeId: string, file: File) => Promise<boolean>;
  onUpdateResource: (resourceId: string, resource: ResourceInput) => Promise<boolean>;
  onStartEditingResource: (resource: Resource) => void;
  onCancelResource: () => void;
  onDeleteResource: (resource: Resource) => void;
};

export function NodeResources({
  node,
  resourceValue,
  editingResourceId,
  onResourceChange,
  onAddResource,
  onUploadResource,
  onUpdateResource,
  onStartEditingResource,
  onCancelResource,
  onDeleteResource,
}: Props) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const openComposer = (nextMode: 'file' | 'link') => {
    setMode(nextMode);
    setIsComposerOpen(true);
  };
  const closeComposer = () => {
    setIsComposerOpen(false);
    onCancelResource();
  };

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
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onCancelResource();
              openComposer('file');
            }}
          >
            <Plus data-icon="inline-start" />
            Recurso
          </Button>
        )}
      </div>
      <div className="pt-4 pb-6">
        {isComposerOpen && (
          <ResourceComposer
            nodeId={node.id}
            resourceValue={resourceValue}
            editingResourceId={editingResourceId}
            mode={mode}
            onModeChange={setMode}
            onResourceChange={onResourceChange}
            onAddResource={onAddResource}
            onUploadResource={onUploadResource}
            onUpdateResource={onUpdateResource}
            onClose={closeComposer}
          />
        )}
        <ResourceList
          resources={node.resources}
          onEdit={(item) => {
            onStartEditingResource(item);
            openComposer(item.type === 'FILE' ? 'file' : 'link');
          }}
          onDelete={onDeleteResource}
        />
      </div>
    </section>
  );
}
