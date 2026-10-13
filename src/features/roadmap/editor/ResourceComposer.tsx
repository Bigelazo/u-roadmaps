import { FileUp, Link2, Save, X } from 'lucide-react';
import type { Resource } from '@/features/roadmap/types';
import { Button } from '@/shared/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { inputClassName } from './primitives';
import { useNodeEditorContext } from './context';
import type { ResourceInput } from './types';

type Props = {
  mode: 'file' | 'link';
  editingResource: Resource | null;
  onModeChange: (mode: 'file' | 'link') => void;
  onClose: () => void;
};

const resourceTabs = [
  { mode: 'file', label: 'Archivo', Icon: FileUp },
  { mode: 'link', label: 'Enlace', Icon: Link2 },
] as const;

function sessionValue(
  session: ReturnType<typeof useNodeEditorContext>['resourceSession'],
): ResourceInput {
  return session.kind === 'closed' ? { title: '', url: '', type: 'LINK' } : session.value;
}

function canSaveResource(
  mode: Props['mode'],
  isEditingResource: boolean,
  resourceValue: ResourceInput,
  selectedFile: File | null,
  editingResource: Resource | null,
) {
  const hasChanges =
    !editingResource ||
    resourceValue.title !== editingResource.title ||
    resourceValue.url !== editingResource.url ||
    resourceValue.type !== editingResource.type;
  const hasRequiredLinkFields = Boolean(resourceValue.title.trim() && resourceValue.url.trim());
  return mode === 'file' && !isEditingResource
    ? Boolean(selectedFile)
    : hasChanges &&
        Boolean(resourceValue.title.trim()) &&
        (mode !== 'link' || hasRequiredLinkFields);
}

function resourceSubmitLabel(mode: Props['mode'], isEditingResource: boolean) {
  if (isEditingResource) return mode === 'link' ? 'Guardar enlace' : 'Guardar recurso';
  return mode === 'file' ? 'Subir archivo' : 'Agregar enlace';
}

export function ResourceComposer({ mode, editingResource, onModeChange, onClose }: Props) {
  const { resourceSession, changeResource, selectResourceFile, saveResource, pendingEditorEffect } =
    useNodeEditorContext();
  const isEditingResource = resourceSession.kind === 'editing-existing';
  const resourceValue = sessionValue(resourceSession);
  const selectedFile = resourceSession.kind === 'adding-file' ? resourceSession.selectedFile : null;
  const canSave = canSaveResource(
    mode,
    isEditingResource,
    resourceValue,
    selectedFile,
    editingResource,
  );
  const isPending = Boolean(pendingEditorEffect);

  const resourceFields =
    mode === 'file' && !isEditingResource ? (
      <Field>
        <FieldLabel htmlFor="resource-file">Archivo</FieldLabel>
        <label
          htmlFor="resource-file"
          className="mt-1 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-5 text-center transition-colors focus-within:ring-3 focus-within:ring-ring/50 hover:bg-primary/10"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            selectResourceFile(event.dataTransfer.files.item(0));
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
            onChange={(event) => selectResourceFile(event.target.files?.item(0) ?? null)}
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
            onChange={(event) => changeResource({ ...resourceValue, title: event.target.value })}
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
              onChange={(event) => changeResource({ ...resourceValue, url: event.target.value })}
              required
            />
          </Field>
        )}
      </FieldGroup>
    );

  return (
    <form
      className="mb-4 flex flex-col gap-3 border-y border-dashed border-border py-4"
      aria-label="Editor de recurso"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave && !isPending) saveResource();
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
      {isEditingResource ? (
        resourceFields
      ) : (
        <Tabs
          value={mode}
          onValueChange={(value) => {
            if (value === 'file' || value === 'link') onModeChange(value);
          }}
        >
          <TabsList
            activateOnFocus
            className="w-full group-data-horizontal/tabs:h-auto"
            aria-label="Tipo de recurso"
          >
            {resourceTabs.map(({ mode: tabMode, label, Icon }) => (
              <TabsTrigger key={tabMode} value={tabMode} className="min-h-11">
                <Icon data-icon="inline-start" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          {resourceTabs.map(({ mode: tabMode }) => (
            <TabsContent key={tabMode} value={tabMode}>
              {mode === tabMode ? resourceFields : null}
            </TabsContent>
          ))}
        </Tabs>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!canSave || isPending}>
          <Save data-icon="inline-start" />
          {resourceSubmitLabel(mode, isEditingResource)}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
