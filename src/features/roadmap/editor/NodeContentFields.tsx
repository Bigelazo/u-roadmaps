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
}: FieldProps & { placeholder?: string }) {
  return (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-description`}>
        Descripción o Contenido del nodo{' '}
        <em className="font-normal text-muted-foreground">opcional</em>
      </FieldLabel>
      <MarkdownEditor
        id={`${idPrefix}-description`}
        aria-describedby={`${idPrefix}-description-help`}
        placeholder={placeholder}
        value={value.description}
        onValueChange={(description) => onChange({ description })}
      />
      <FieldDescription id={`${idPrefix}-description-help`} className="italic">
        El texto es compatible con Markdown. Puedes arrastrar un archivo .md para reemplazarlo.
      </FieldDescription>
    </Field>
  );
}

type Props = FieldProps & {
  nodeTypes: RoadmapDto['nodeTypes'];
  titlePlaceholder?: string;
  descriptionPlaceholder?: string;
  titleError?: string;
};

export function NodeContentFields({
  nodeTypes,
  titlePlaceholder,
  descriptionPlaceholder,
  titleError,
  ...field
}: Props) {
  return (
    <>
      <NodeTitleField {...field} placeholder={titlePlaceholder} error={titleError} />
      <NodeDescriptionField {...field} placeholder={descriptionPlaceholder} />
      <NodeTypeField {...field} nodeTypes={nodeTypes} />
    </>
  );
}
