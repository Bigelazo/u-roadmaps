import { useState } from 'react';
import { FileUp, Link2, Save, X } from 'lucide-react';
import type { Resource } from '@/features/roadmap/types';
import { Button } from '@/shared/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/field';
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

function hasResourceChanges(resourceValue: ResourceInput, editingResource: Resource | null) {
  return (
    !editingResource ||
    resourceValue.title !== editingResource.title ||
    resourceValue.url !== editingResource.url ||
    resourceValue.type !== editingResource.type
  );
}

function isWebAddress(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}

function resourceErrors(mode: Props['mode'], editableTitle: string, url: string) {
  return {
    title: editableTitle.trim() ? undefined : 'Escribe un título para el recurso.',
    url:
      mode !== 'link'
        ? undefined
        : !url.trim()
          ? 'Ingresa el enlace del recurso.'
          : isWebAddress(url)
            ? undefined
            : 'Ingresa un enlace completo, por ejemplo https://ejemplo.cl.',
  };
}

function resourceSubmitLabel(mode: Props['mode'], isEditingResource: boolean) {
  if (isEditingResource) return mode === 'link' ? 'Guardar enlace' : 'Guardar recurso';
  return mode === 'file' ? 'Subir archivo' : 'Agregar enlace';
}

function ResourceFileField({
  selectedFile,
  selectResourceFile,
}: {
  selectedFile: File | null;
  selectResourceFile: (file: File | null) => void;
}) {
  return (
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
  );
}

function ResourceTextFields({
  mode,
  resourceValue,
  editableTitle,
  extension,
  titleError,
  urlError,
  changeResource,
}: {
  mode: Props['mode'];
  resourceValue: ResourceInput;
  editableTitle: string;
  extension: string;
  titleError: string | undefined;
  urlError: string | undefined;
  changeResource: (value: ResourceInput) => void;
}) {
  return (
    <FieldGroup className="gap-3">
      <Field data-invalid={titleError ? true : undefined}>
        <FieldLabel htmlFor="resource-title">Título</FieldLabel>
        <div className="flex items-center gap-2">
          <Input
            id="resource-title"
            className={inputClassName}
            placeholder="Ej. Guía de ejercicios"
            value={editableTitle}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={
              [extension && 'resource-extension', titleError && 'resource-title-error']
                .filter(Boolean)
                .join(' ') || undefined
            }
            onChange={(event) =>
              changeResource({ ...resourceValue, title: event.target.value + extension })
            }
            required
          />
          {extension ? (
            <span id="resource-extension" className="shrink-0 text-sm text-muted-foreground">
              <span className="sr-only">Extensión del archivo: </span>
              {extension}
            </span>
          ) : null}
        </div>
        {titleError ? <FieldError id="resource-title-error">{titleError}</FieldError> : null}
      </Field>
      {mode === 'link' && (
        <Field data-invalid={urlError ? true : undefined}>
          <FieldLabel htmlFor="resource-url">Enlace</FieldLabel>
          <Input
            id="resource-url"
            className={inputClassName}
            type="url"
            placeholder="https://"
            value={resourceValue.url}
            onChange={(event) => changeResource({ ...resourceValue, url: event.target.value })}
            aria-invalid={urlError ? true : undefined}
            aria-describedby={urlError ? 'resource-url-error' : undefined}
            required
          />
          {urlError ? <FieldError id="resource-url-error">{urlError}</FieldError> : null}
        </Field>
      )}
    </FieldGroup>
  );
}

function resourceTitle(resourceValue: ResourceInput, editingResource: Resource | null) {
  const extensionIndex = editingResource?.title.lastIndexOf('.') ?? -1;
  const extension =
    editingResource?.type === 'FILE' &&
    extensionIndex > 0 &&
    extensionIndex < editingResource.title.length - 1
      ? editingResource.title.slice(extensionIndex)
      : '';
  const editableTitle = extension
    ? resourceValue.title.slice(0, -extension.length)
    : resourceValue.title;
  return { extension, editableTitle };
}

export function ResourceComposer({ mode, editingResource, onModeChange, onClose }: Props) {
  const { resourceSession, changeResource, selectResourceFile, saveResource, pendingEditorEffect } =
    useNodeEditorContext();
  const isEditingResource = resourceSession.kind === 'editing-existing';
  const resourceValue = sessionValue(resourceSession);
  const selectedFile = resourceSession.kind === 'adding-file' ? resourceSession.selectedFile : null;
  const { extension, editableTitle } = resourceTitle(resourceValue, editingResource);
  const isAddingFile = mode === 'file' && !isEditingResource;
  // Text fields stay submittable so a submit can explain what is missing.
  const canSave = isAddingFile
    ? Boolean(selectedFile)
    : hasResourceChanges(resourceValue, editingResource);
  const [showErrors, setShowErrors] = useState(false);
  const errors = isAddingFile
    ? { title: undefined, url: undefined }
    : resourceErrors(mode, editableTitle, resourceValue.url);
  const titleError = showErrors ? errors.title : undefined;
  const urlError = showErrors ? errors.url : undefined;
  const isPending = Boolean(pendingEditorEffect);

  const resourceFields = isAddingFile ? (
    <ResourceFileField selectedFile={selectedFile} selectResourceFile={selectResourceFile} />
  ) : (
    <ResourceTextFields
      mode={mode}
      resourceValue={resourceValue}
      editableTitle={editableTitle}
      extension={extension}
      titleError={titleError}
      urlError={urlError}
      changeResource={changeResource}
    />
  );

  return (
    <form
      noValidate
      className="mb-4 flex flex-col gap-3 border-y border-dashed border-border py-4"
      aria-label="Editor de recurso"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave || isPending) return;
        if (errors.title || errors.url) {
          setShowErrors(true);
          document.getElementById(errors.title ? 'resource-title' : 'resource-url')?.focus();
          return;
        }
        saveResource();
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
