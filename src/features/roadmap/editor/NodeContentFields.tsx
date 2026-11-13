import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';
import type { RoadmapDto } from '@/features/roadmap/types';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { MarkdownEditor } from './MarkdownEditor';
import { inputClassName, NodeTypeSelect } from './primitives';

type NodeContent = { title: string; description: string; nodeTypeId: string };

type FieldProps = {
  idPrefix: string;
  value: NodeContent;
  onChange: (patch: Partial<NodeContent>) => void;
};

export function NodeTitleField({
  idPrefix,
  value,
  onChange,
  placeholder,
  error,
  form,
}: FieldProps & { placeholder?: string; error?: string; form?: string }) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={`${idPrefix}-title`}>Título</FieldLabel>
      <Input
        id={`${idPrefix}-title`}
        form={form}
        className={inputClassName}
        placeholder={placeholder}
        value={value.title}
        onChange={(event) => onChange({ title: event.target.value })}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${idPrefix}-title-error` : undefined}
        required
      />
      {error ? <FieldError id={`${idPrefix}-title-error`}>{error}</FieldError> : null}
    </Field>
  );
}

export function NodeTypeField({
  idPrefix,
  nodeTypes,
  value,
  onChange,
}: FieldProps & { nodeTypes: RoadmapDto['nodeTypes'] }) {
  return (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-type`}>Tipo</FieldLabel>
      <NodeTypeSelect
        id={`${idPrefix}-type`}
        nodeTypes={nodeTypes}
        value={value.nodeTypeId}
        onValueChange={(nodeTypeId) => onChange({ nodeTypeId })}
      />
    </Field>
  );
}

export function NodeDescriptionField({
  idPrefix,
  value,
  onChange,
  placeholder,
  action,
}: FieldProps & { placeholder?: string; action?: ReactNode }) {
  const label = (
    <FieldLabel htmlFor={`${idPrefix}-description`}>
      Contenido <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
    </FieldLabel>
  );

  return (
    <Field>
      {action ? (
        <div className="-my-2.5 -mr-3.5 flex items-center justify-between gap-2">
          {label}
          {action}
        </div>
      ) : (
        label
      )}
      <MarkdownEditor
        id={`${idPrefix}-description`}
        aria-describedby={`${idPrefix}-description-help`}
        placeholder={placeholder}
        value={value.description}
        onValueChange={(description) => onChange({ description })}
      />
      <FieldDescription id={`${idPrefix}-description-help`} className="flex items-start gap-1.5">
        <FileText aria-hidden="true" className="mt-0.75 size-3.5 shrink-0" />
        <span>Admite Markdown · Arrastra un archivo .md para reemplazar el texto</span>
      </FieldDescription>
    </Field>
  );
}

type Props = FieldProps & {
  nodeTypes: RoadmapDto['nodeTypes'];
  titlePlaceholder?: string;
  descriptionPlaceholder?: string;
  descriptionAction?: ReactNode;
  titleError?: string;
  titleForm?: string;
};

export function NodeContentFields({
  nodeTypes,
  titlePlaceholder,
  descriptionPlaceholder,
  descriptionAction,
  titleError,
  titleForm,
  ...field
}: Props) {
  return (
    <>
      <NodeTitleField
        {...field}
        placeholder={titlePlaceholder}
        error={titleError}
        form={titleForm}
      />
      <NodeTypeField {...field} nodeTypes={nodeTypes} />
      <NodeDescriptionField
        {...field}
        placeholder={descriptionPlaceholder}
        action={descriptionAction}
      />
    </>
  );
}
