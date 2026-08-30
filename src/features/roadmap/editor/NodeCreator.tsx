'use client';

import { useEffect, useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { CirclePlus, Plus, Shapes } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { inputClassName, NodeTypeSelect } from './primitives';
import { NodeTypesEditor } from './NodeTypesEditor';
import type { NodeInput, NodeTypeInput } from './types';

type Props = {
  nodeTypes: RoadmapDto['nodeTypes'];
  onSubmit: (node: NodeInput) => Promise<boolean>;
  onCreateNodeType: (nodeType: NodeTypeInput) => Promise<boolean>;
  onUpdateNodeType: (nodeTypeId: string, nodeType: NodeTypeInput) => Promise<boolean>;
  onDeleteNodeType: (nodeTypeId: string) => Promise<boolean>;
};

export function NodeCreator({
  nodeTypes,
  onSubmit,
  onCreateNodeType,
  onUpdateNodeType,
  onDeleteNodeType,
}: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNodeDialogOpen, setIsNodeDialogOpen] = useState(false);
  const [isNodeTypesDialogOpen, setIsNodeTypesDialogOpen] = useState(false);
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
    <>
      <Menu.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Menu.Trigger
          aria-label="Crear en el mapa"
          title="Crear en el mapa"
          render={<Button type="button" size="icon" className="cursor-pointer rounded-full" />}
          onMouseDown={() => setIsMenuOpen(true)}
        >
          <Plus aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" side="bottom" sideOffset={8}>
            <Menu.Popup className="z-40 min-w-52 rounded-lg border border-border bg-popover p-1.5 text-sm shadow-lg outline-none">
              <Menu.Item
                className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left outline-none data-[highlighted]:bg-muted"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsNodeDialogOpen(true);
                }}
              >
                <CirclePlus className="size-4" aria-hidden="true" />
                Crear nodo
              </Menu.Item>
              <Menu.Item
                className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left outline-none data-[highlighted]:bg-muted"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsNodeTypesDialogOpen(true);
                }}
              >
                <Shapes className="size-4" aria-hidden="true" />
                Gestionar tipos de nodo
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Dialog open={isNodeDialogOpen} onOpenChange={setIsNodeDialogOpen}>
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
                setIsNodeDialogOpen(false);
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
                  onValueChange={(nodeTypeId) =>
                    setValue((current) => ({ ...current, nodeTypeId }))
                  }
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
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={!hasNodeTypes}>
                <Plus data-icon="inline-start" />
                Agregar nodo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isNodeTypesDialogOpen} onOpenChange={setIsNodeTypesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tipos de nodo</DialogTitle>
            <DialogDescription>
              Crea y organiza las categorías que aparecen en la leyenda del mapa.
            </DialogDescription>
          </DialogHeader>
          <NodeTypesEditor
            nodeTypes={nodeTypes}
            onAdd={onCreateNodeType}
            onUpdate={onUpdateNodeType}
            onDelete={onDeleteNodeType}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
