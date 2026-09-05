import { FileUp, Link2, Save, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import type { Resource } from '@/features/roadmap/types';
import { inputClassName } from './primitives';
import type { ResourceInput } from './types';

type Props = {
  nodeId: string;
  resourceValue: ResourceInput;
  editingResourceId: string | null;
  editingResource: Resource | null;
  mode: 'file' | 'link';
  selectedFile: File | null;
  onModeChange: (mode: 'file' | 'link') => void;
  onSelectedFileChange: (file: File | null) => void;
  onResourceChange: (value: ResourceInput) => void;
  onAddResource: (nodeId: string, resource: ResourceInput) => Promise<boolean>;
  onUploadResource: (nodeId: string, file: File) => Promise<boolean>;
  onUpdateResource: (resourceId: string, resource: ResourceInput) => Promise<boolean>;
  onClose: () => void;
};

export function ResourceComposer({
  nodeId,
  resourceValue,
  editingResourceId,
  editingResource,
  mode,
  selectedFile,
  onModeChange,
  onSelectedFileChange,
  onResourceChange,
  onAddResource,
  onUploadResource,
  onUpdateResource,
  onClose,
}: Props) {
  const isEditingResource = Boolean(editingResourceId);
  const hasChanges =
    !editingResource ||
    resourceValue.title !== editingResource.title ||
    resourceValue.url !== editingResource.url ||
    resourceValue.type !== editingResource.type;
  const hasRequiredLinkFields = Boolean(resourceValue.title.trim() && resourceValue.url.trim());
  const canSave =
    mode === 'file' && !isEditingResource
      ? Boolean(selectedFile)
      : hasChanges &&
        Boolean(resourceValue.title.trim()) &&
        (mode !== 'link' || hasRequiredLinkFields);

  return (
    <form
      className="mb-4 flex flex-col gap-3 border-y border-dashed border-border py-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!canSave) return;
        const saved =
          mode === 'file' && !isEditingResource
            ? await onUploadResource(nodeId, selectedFile!)
            : isEditingResource
              ? await onUpdateResource(editingResourceId!, resourceValue)
              : await onAddResource(nodeId, { ...resourceValue, type: 'LINK' });
        if (saved) {
          onClose();
        }
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {isEditingResource ? 'Editar recurso' : 'Nuevo recurso'}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Cerrar editor de recurso"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      {!isEditingResource && (
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-cloud p-1" role="tablist">
          <Button
            type="button"
            role="tab"
            aria-selected={mode === 'file'}
            variant={mode === 'file' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onModeChange('file')}
          >
            <FileUp data-icon="inline-start" />
            Archivo
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={mode === 'link'}
            variant={mode === 'link' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onModeChange('link')}
          >
            <Link2 data-icon="inline-start" />
            Enlace
          </Button>
        </div>
      )}
      {mode === 'file' && !isEditingResource ? (
        <Field>
          <FieldLabel htmlFor="resource-file">Archivo</FieldLabel>
          <label
            htmlFor="resource-file"
            className="mt-1 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-5 text-center transition-colors focus-within:ring-3 focus-within:ring-ring/50 hover:bg-primary/10"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              onSelectedFileChange(event.dataTransfer.files.item(0));
            }}
          >
            <FileUp className="mb-2 size-5 text-primary" />
            <span className="text-sm font-semibold">
              {selectedFile ? selectedFile.name : 'Arrastra un archivo aquí'}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              {selectedFile ? 'Listo para subir' : 'o selecciónalo desde tu computador'}
            </span>
            <input
              id="resource-file"
              className="sr-only"
              type="file"
              onChange={(event) => onSelectedFileChange(event.target.files?.item(0) ?? null)}
            />
          </label>
          <p className="mt-1 text-xs text-muted-foreground">Máximo 25 MB.</p>
        </Field>
      ) : (
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="resource-title">Título</FieldLabel>
            <Input
              id="resource-title"
              className={inputClassName}
              placeholder="Ej. Guía de ejercicios"
              value={resourceValue.title}
              onChange={(event) =>
                onResourceChange({ ...resourceValue, title: event.target.value })
              }
              required
            />
          </Field>
          {mode === 'link' && (
            <Field>
              <FieldLabel htmlFor="resource-url">Enlace</FieldLabel>
              <Input
                id="resource-url"
                className={inputClassName}
                type="url"
                placeholder="https://"
                value={resourceValue.url}
                onChange={(event) =>
                  onResourceChange({ ...resourceValue, url: event.target.value })
                }
                required
              />
            </Field>
          )}
        </FieldGroup>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!canSave}>
          <Save data-icon="inline-start" />
          {isEditingResource
            ? mode === 'link'
              ? 'Guardar enlace'
              : 'Guardar recurso'
            : mode === 'file'
              ? 'Subir archivo'
              : 'Agregar enlace'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
