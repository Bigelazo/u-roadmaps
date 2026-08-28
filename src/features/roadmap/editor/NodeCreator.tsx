'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { RoadmapDto } from '@/lib/roadmap-types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { inputClassName, NodeTypeSelect } from './primitives';
import type { NodeInput } from './types';

type Props = {
  nodeTypes: RoadmapDto['nodeTypes'];
  onSubmit: (node: NodeInput) => Promise<boolean>;
};

export function NodeCreator({ nodeTypes, onSubmit }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState<NodeInput>(() => ({
    title: '',
    description: '',
    nodeTypeId: nodeTypes[0]?.id ?? '',
    isVisible: true,
  }));
  const hasNodeTypes = nodeTypes.length > 0;

  useEffect(() => {
    setValue((current) => ({
      ...current,
      nodeTypeId: nodeTypes.some((type) => type.id === current.nodeTypeId)
        ? current.nodeTypeId
        : (nodeTypes[0]?.id ?? ''),
    }));
  }, [nodeTypes]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button className="absolute top-5 right-5 z-[5] shadow-sm" />}>
        <Plus data-icon="inline-start" />
        Agregar nodo
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Agregar al mapa</DialogTitle>
          <DialogDescription>Crea un hito y luego conéctalo desde el lienzo.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (value.title.trim() && value.nodeTypeId && (await onSubmit(value))) {
              setValue((current) => ({ ...current, title: '', description: '' }));
              setIsOpen(false);
            }
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-node-title">Título</FieldLabel>
              <Input
                id="new-node-title"
                className={inputClassName}
                placeholder="Ej. Repasar límites"
                value={value.title}
                onChange={(event) =>
                  setValue((current) => ({ ...current, title: event.target.value }))
                }
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-node-description">
                Descripción <span className="font-normal text-muted-foreground">(opcional)</span>
              </FieldLabel>
              <Textarea
                id="new-node-description"
                placeholder="Qué debe lograr el estudiante en este hito"
                value={value.description}
                onChange={(event) =>
                  setValue((current) => ({ ...current, description: event.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-node-type">Tipo</FieldLabel>
              <NodeTypeSelect
                id="new-node-type"
                nodeTypes={nodeTypes}
                value={value.nodeTypeId}
                onValueChange={(nodeTypeId) => setValue((current) => ({ ...current, nodeTypeId }))}
              />
            </Field>
            <Field orientation="horizontal" className="rounded-lg bg-cloud px-3 py-2.5">
              <Checkbox
                id="new-node-visible"
                checked={value.isVisible}
                onCheckedChange={(checked) =>
                  setValue((current) => ({ ...current, isVisible: checked }))
                }
              />
              <FieldLabel htmlFor="new-node-visible">Visible para estudiantes</FieldLabel>
            </Field>
          </FieldGroup>
          {!hasNodeTypes && (
            <p className="text-sm text-destructive">
              Crea primero un tipo de nodo para poder agregar contenido.
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={!hasNodeTypes}>
              <Plus data-icon="inline-start" />
              Agregar nodo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
