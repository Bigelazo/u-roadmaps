import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { Resource, RoadmapNode } from '@/features/roadmap/types';
import { Button } from '@/shared/ui/button';
import { ResourceComposer } from './ResourceComposer';
import { ResourceList } from './ResourceList';
import type { ResourceInput } from './types';

type Props = {
  node: RoadmapNode;
  resourceValue: ResourceInput;
  editingResourceId: string | null;
  isComposerOpen: boolean;
  mode: 'file' | 'link';
  selectedFile: File | null;
  onResourceChange: (value: ResourceInput) => void;
  onComposerOpen: (mode: 'file' | 'link') => void;
  onComposerClose: () => void;
  onModeChange: (mode: 'file' | 'link') => void;
  onSelectedFileChange: (file: File | null) => void;
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
  isComposerOpen,
  mode,
  selectedFile,
  onResourceChange,
  onComposerOpen,
  onComposerClose,
  onModeChange,
  onSelectedFileChange,
  onAddResource,
  onUploadResource,
  onUpdateResource,
  onStartEditingResource,
  onCancelResource,
  onDeleteResource,
}: Props) {
  const [localComposerOpen, setLocalComposerOpen] = useState(false);
  const [localMode, setLocalMode] = useState<'file' | 'link'>('file');
  const [localSelectedFile, setLocalSelectedFile] = useState<File | null>(null);
  const composerOpen = isComposerOpen || localComposerOpen;
  const composerMode = isComposerOpen ? mode : localMode;
  const composerSelectedFile = isComposerOpen ? selectedFile : localSelectedFile;
  const openComposer = (nextMode: 'file' | 'link') => {
    setLocalMode(nextMode);
    setLocalSelectedFile(null);
    setLocalComposerOpen(true);
    onComposerOpen(nextMode);
  };
  const closeComposer = () => {
    setLocalComposerOpen(false);
    setLocalSelectedFile(null);
    onComposerClose();
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
        {!composerOpen && (
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
        {composerOpen && (
          <ResourceComposer
            nodeId={node.id}
            resourceValue={resourceValue}
            editingResourceId={editingResourceId}
            editingResource={node.resources.find((resource) => resource.id === editingResourceId) ?? null}
            mode={composerMode}
            selectedFile={composerSelectedFile}
            onModeChange={(nextMode) => {
              setLocalMode(nextMode);
              onModeChange(nextMode);
            }}
            onSelectedFileChange={(file) => {
              setLocalSelectedFile(file);
              onSelectedFileChange(file);
            }}
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
