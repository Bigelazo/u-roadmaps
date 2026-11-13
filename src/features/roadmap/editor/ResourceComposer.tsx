import { useState } from 'react';
import { FileUp, Link2, Save, Undo2, X } from 'lucide-react';
import type { Resource } from '@/features/roadmap/types';
import { Button } from '@/shared/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import {
  fileTitleExtension,
  resourceFileError,
  uploadedContentType,
} from '@/features/roadmap/domain/resource';
import { ResourceIcon } from '@/features/roadmap/ui/ResourceIcon';
import { inputClassName } from './primitives';
import { useNodeEditorContext } from './context';
import type { ResourceInput } from './types';

type Mode = 'file' | 'link';

type Props = {
  mode: Mode;
  editingResource: Resource | null;
  onModeChange: (mode: Mode) => void;
  onClose: () => void;
};

export type ResourceComposerFormProps = Props & {
  idPrefix?: string;
  value: ResourceInput;
  selectedFile: File | null;
  replacementFile: File | null;
  isPending?: boolean;
  fileSubmitLabel?: string;
  onValueChange: (value: ResourceInput) => void;
  onSelectFile: (file: File | null) => void;
  onSave: () => void;
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

function hasResourceChanges(
  resourceValue: ResourceInput,
  editingResource: Resource | null,
  replacementFile: File | null,
) {
  return (
    !editingResource ||
    Boolean(replacementFile) ||
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

function resourceErrors(mode: Mode, editableTitle: string, url: string) {
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

function resourceSubmitLabel(mode: Mode, isEditingResource: boolean, fileSubmitLabel: string) {
  if (isEditingResource) return mode === 'link' ? 'Guardar enlace' : 'Guardar recurso';
  return mode === 'file' ? fileSubmitLabel : 'Agregar enlace';
}

function ResourceFileField({
  idPrefix,
  selectedFile,
  fileError,
  selectResourceFile,
}: {
  idPrefix: string;
  selectedFile: File | null;
  fileError: string | null;
  selectResourceFile: (file: File | null) => void;
}) {
  return (
    <Field data-invalid={fileError ? true : undefined}>
      <FieldLabel htmlFor={`${idPrefix}-file`}>Archivo</FieldLabel>
      <label
        htmlFor={`${idPrefix}-file`}
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
          {selectedFile && !fileError ? 'Listo para subir' : 'o selecciónalo desde tu computador'}
        </span>
        <input
          id={`${idPrefix}-file`}
          className="sr-only"
          type="file"
          aria-invalid={fileError ? true : undefined}
          aria-describedby={`${idPrefix}-file-help`}
          onChange={(event) => selectResourceFile(event.target.files?.item(0) ?? null)}
        />
      </label>
      {fileError ? (
        <FieldError id={`${idPrefix}-file-help`}>{fileError}</FieldError>
      ) : (
        <p id={`${idPrefix}-file-help`} className="mt-1 text-xs text-muted-foreground">
          Máximo 25 MB.
        </p>
      )}
    </Field>
  );
}

function ResourceReplacementField({
  idPrefix,
  replacementFile,
  fileError,
  selectResourceFile,
}: {
  idPrefix: string;
  replacementFile: File | null;
  fileError: string | null;
  selectResourceFile: (file: File | null) => void;
}) {
  return (
    <Field data-invalid={fileError ? true : undefined}>
      <FieldLabel htmlFor={`${idPrefix}-file`}>Reemplazar archivo</FieldLabel>
      <input
        key={replacementFile ? 'selected' : 'empty'}
        id={`${idPrefix}-file`}
        aria-invalid={fileError ? true : undefined}
        aria-describedby={`${idPrefix}-file-help`}
        className="peer sr-only"
        type="file"
        tabIndex={replacementFile ? -1 : undefined}
        onChange={(event) => selectResourceFile(event.target.files?.item(0) ?? null)}
      />
      {replacementFile ? (
        <div className="flex min-h-11 flex-wrap items-center gap-x-2 rounded-lg border border-primary/40 bg-primary/5 py-1 pr-1 pl-3">
          <ResourceIcon
            resource={{
              type: 'FILE',
              title: replacementFile.name,
              fileContentType: uploadedContentType(replacementFile),
            }}
            size={18}
            className="shrink-0 text-primary"
          />
          <span className="min-w-0 flex-1 basis-40">
            <span className="block truncate text-sm font-semibold">{replacementFile.name}</span>
            <span className="block text-xs text-muted-foreground">
              Reemplazará al actual al guardar
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto min-h-11 shrink-0"
            onClick={() => selectResourceFile(null)}
          >
            <Undo2 data-icon="inline-start" />
            Mantener actual
          </Button>
        </div>
      ) : (
        <label
          htmlFor={`${idPrefix}-file`}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 hover:bg-primary/10"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            selectResourceFile(event.dataTransfer.files.item(0));
          }}
        >
          <FileUp className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 text-sm font-semibold">Arrastra o selecciona un archivo</span>
        </label>
      )}
      {fileError ? (
        <FieldError id={`${idPrefix}-file-help`}>{fileError}</FieldError>
      ) : (
        <p id={`${idPrefix}-file-help`} className="mt-1 text-xs text-muted-foreground">
          Opcional. Máximo 25 MB.
        </p>
      )}
    </Field>
  );
}

function ResourceTextFields({
  idPrefix,
  mode,
  resourceValue,
  editableTitle,
  extension,
  titleError,
  urlError,
  changeResource,
}: {
  idPrefix: string;
  mode: Mode;
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
        <FieldLabel htmlFor={`${idPrefix}-title`}>Título</FieldLabel>
        <div className="flex items-center gap-2">
          <Input
            id={`${idPrefix}-title`}
            className={inputClassName}
            placeholder="Ej. Guía de ejercicios"
            value={editableTitle}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={
              [extension && `${idPrefix}-extension`, titleError && `${idPrefix}-title-error`]
                .filter(Boolean)
                .join(' ') || undefined
            }
            onChange={(event) =>
              changeResource({ ...resourceValue, title: event.target.value + extension })
            }
            required
          />
          {extension ? (
            <span id={`${idPrefix}-extension`} className="shrink-0 text-sm text-muted-foreground">
              <span className="sr-only">Extensión del archivo: </span>
              {extension}
            </span>
          ) : null}
        </div>
        {titleError ? <FieldError id={`${idPrefix}-title-error`}>{titleError}</FieldError> : null}
      </Field>
      {mode === 'link' && (
        <Field data-invalid={urlError ? true : undefined}>
          <FieldLabel htmlFor={`${idPrefix}-url`}>Enlace</FieldLabel>
          <Input
            id={`${idPrefix}-url`}
            className={inputClassName}
            type="url"
            placeholder="https://"
            value={resourceValue.url}
            onChange={(event) => changeResource({ ...resourceValue, url: event.target.value })}
            aria-invalid={urlError ? true : undefined}
            aria-describedby={urlError ? `${idPrefix}-url-error` : undefined}
            required
          />
          {urlError ? <FieldError id={`${idPrefix}-url-error`}>{urlError}</FieldError> : null}
        </Field>
      )}
    </FieldGroup>
  );
}

function resourceTitle(
  resourceValue: ResourceInput,
  editingResource: Resource | null,
  replacementFile: File | null,
) {
  const extension =
    editingResource?.type === 'FILE'
      ? fileTitleExtension(replacementFile?.name ?? editingResource.title)
      : '';
  const editableTitle = extension
    ? resourceValue.title.slice(0, -extension.length)
    : resourceValue.title;
  return { extension, editableTitle };
}

export function ResourceComposerForm({
  idPrefix = 'resource',
  mode,
  editingResource,
  onModeChange,
  onClose,
  value: resourceValue,
  selectedFile,
  replacementFile,
  isPending = false,
  fileSubmitLabel = 'Subir archivo',
  onValueChange: changeResource,
  onSelectFile: selectResourceFile,
  onSave,
}: ResourceComposerFormProps) {
  const isEditingResource = editingResource !== null;
  const { extension, editableTitle } = resourceTitle(
    resourceValue,
    editingResource,
    replacementFile,
  );
  const isAddingFile = mode === 'file' && !isEditingResource;
  const fileError = resourceFileError(isAddingFile ? selectedFile : replacementFile);
  const canSave =
    !fileError &&
    (isAddingFile
      ? Boolean(selectedFile)
      : hasResourceChanges(resourceValue, editingResource, replacementFile));
  const [showErrors, setShowErrors] = useState(false);
  const errors = isAddingFile
    ? { title: undefined, url: undefined }
    : resourceErrors(mode, editableTitle, resourceValue.url);
  const titleError = showErrors ? errors.title : undefined;
  const urlError = showErrors ? errors.url : undefined;

  const resourceFields = isAddingFile ? (
    <ResourceFileField
      idPrefix={idPrefix}
      selectedFile={selectedFile}
      fileError={fileError}
      selectResourceFile={selectResourceFile}
    />
  ) : (
    <>
      <ResourceTextFields
        idPrefix={idPrefix}
        mode={mode}
        resourceValue={resourceValue}
        editableTitle={editableTitle}
        extension={extension}
        titleError={titleError}
        urlError={urlError}
        changeResource={changeResource}
      />
      {editingResource?.type === 'FILE' ? (
        <ResourceReplacementField
          idPrefix={idPrefix}
          replacementFile={replacementFile}
          fileError={fileError}
          selectResourceFile={selectResourceFile}
        />
      ) : null}
    </>
  );

  return (
    <form
      id={`${idPrefix}-composer`}
      noValidate
      className="mb-4 flex flex-col gap-3 border-y border-dashed border-border py-4"
      aria-label="Editor de recurso"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave || isPending) return;
        if (errors.title || errors.url) {
          setShowErrors(true);
          document.getElementById(`${idPrefix}-${errors.title ? 'title' : 'url'}`)?.focus();
          return;
        }
        onSave();
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
          {resourceSubmitLabel(mode, isEditingResource, fileSubmitLabel)}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function ResourceComposer(props: Props) {
  const { resourceSession, changeResource, selectResourceFile, saveResource, pendingEditorEffect } =
    useNodeEditorContext();
  return (
    <ResourceComposerForm
      {...props}
      editingResource={resourceSession.kind === 'editing-existing' ? props.editingResource : null}
      value={sessionValue(resourceSession)}
      selectedFile={resourceSession.kind === 'adding-file' ? resourceSession.selectedFile : null}
      replacementFile={
        resourceSession.kind === 'editing-existing' ? resourceSession.replacementFile : null
      }
      isPending={Boolean(pendingEditorEffect)}
      onValueChange={changeResource}
      onSelectFile={selectResourceFile}
      onSave={saveResource}
    />
  );
}
