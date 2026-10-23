import type { RoadmapDto } from '@/features/roadmap/types';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { MarkdownEditor } from './MarkdownEditor';
import { inputClassName, NodeTypeSelect } from './primitives';

type NodeContent = { title: string; description: string; nodeTypeId: string };

type Props = {
  idPrefix: string;
  nodeTypes: RoadmapDto['nodeTypes'];
  value: NodeContent;
  onChange: (patch: Partial<NodeContent>) => void;
  titlePlaceholder?: string;
  descriptionPlaceholder?: string;
  titleError?: string;
};

export function NodeContentFields({
  idPrefix,
  nodeTypes,
  value,
  onChange,
  titlePlaceholder,
  descriptionPlaceholder,
  titleError,
}: Props) {
  return (
    <>
      <Field data-invalid={titleError ? true : undefined}>
        <FieldLabel htmlFor={`${idPrefix}-title`}>Título</FieldLabel>
        <Input
          id={`${idPrefix}-title`}
          className={inputClassName}
          placeholder={titlePlaceholder}
          value={value.title}
          onChange={(event) => onChange({ title: event.target.value })}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? `${idPrefix}-title-error` : undefined}
          required
        />
        {titleError ? <FieldError id={`${idPrefix}-title-error`}>{titleError}</FieldError> : null}
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-description`}>
          Descripción <span className="font-normal text-muted-foreground">(opcional)</span>
        </FieldLabel>
        <MarkdownEditor
          id={`${idPrefix}-description`}
          aria-describedby={`${idPrefix}-description-help`}
          placeholder={descriptionPlaceholder}
          value={value.description}
          onValueChange={(description) => onChange({ description })}
        />
        <FieldDescription id={`${idPrefix}-description-help`}>
          Admite Markdown: **negrita**, *cursiva*, listas y [enlaces](https://ejemplo.cl). Puedes
          arrastrar un archivo .md para reemplazar el texto, previa confirmación.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-type`}>Tipo</FieldLabel>
        <NodeTypeSelect
          id={`${idPrefix}-type`}
          nodeTypes={nodeTypes}
          value={value.nodeTypeId}
          onValueChange={(nodeTypeId) => onChange({ nodeTypeId })}
        />
      </Field>
    </>
  );
}
