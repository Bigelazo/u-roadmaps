'use client';

import { useRef, useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { CirclePlus, Plus, Shapes } from 'lucide-react';
import type { RoadmapDto } from '@/features/roadmap/types';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { MarkdownEditor } from './MarkdownEditor';
import styles from './NodeCreator.module.css';
import { inputClassName, NodeTypeSelect } from './primitives';
import { NodeTypesEditor } from './NodeTypesEditor';
import { NODE_TYPES_MENU_ITEM_LABEL, type NodeInput, type NodeTypeInput } from './types';

type Props = {
  nodeTypes: RoadmapDto['nodeTypes'];
  onSubmit: (node: NodeInput) => Promise<boolean>;
  onCreateNodeType: (nodeType: NodeTypeInput) => Promise<boolean>;
  onUpdateNodeType: (nodeTypeId: string, nodeType: NodeTypeInput) => Promise<boolean>;
  onRequestDeleteNodeType: (nodeType: RoadmapDto['nodeTypes'][number]) => void;
};

export function NodeCreator({
  nodeTypes,
  onSubmit,
  onCreateNodeType,
  onUpdateNodeType,
  onRequestDeleteNodeType,
}: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNodeDialogOpen, setIsNodeDialogOpen] = useState(false);
  const [isNodeTypesDialogOpen, setIsNodeTypesDialogOpen] = useState(false);
  const menuLayerRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<NodeInput>(() => ({
    title: '',
    description: '',
    nodeTypeId: nodeTypes[0]?.id ?? '',
    isVisible: true,
  }));
  const hasNodeTypes = nodeTypes.length > 0;
  const selectedNodeTypeId = nodeTypes.some((type) => type.id === value.nodeTypeId)
    ? value.nodeTypeId
    : (nodeTypes[0]?.id ?? '');

  return (
    <div ref={menuLayerRef} className={styles.menuLayer}>
      <Menu.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Menu.Trigger
          aria-label="Crear en el mapa"
          title="Crear en el mapa"
          render={
            <Button
              type="button"
              size="icon-lg"
              className={`${styles.trigger} ${isMenuOpen ? styles.triggerOpen : ''}`}
            />
          }
        >
          <span
            aria-hidden="true"
            className={`${styles.menuIcon} ${isMenuOpen ? styles.menuIconOpen : ''}`}
          >
            <span className={styles.menuLine} />
            <span className={styles.menuLine} />
            <span className={styles.menuLine} />
          </span>
        </Menu.Trigger>
        <Menu.Portal container={menuLayerRef}>
          <Menu.Positioner align="end" side="top" sideOffset={-34} className={styles.positioner}>
            <Menu.Popup className={styles.menu}>
              <Menu.Item
                className={styles.menuItem}
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsNodeDialogOpen(true);
                }}
              >
                <CirclePlus aria-hidden="true" />
                Crear nodo
              </Menu.Item>
              <Menu.Item
                className={styles.menuItem}
                aria-label={NODE_TYPES_MENU_ITEM_LABEL}
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsNodeTypesDialogOpen(true);
                }}
              >
                <Shapes aria-hidden="true" />
                Tipos de nodo
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
            action={async () => {
              if (
                value.title.trim() &&
                selectedNodeTypeId &&
                (await onSubmit({ ...value, nodeTypeId: selectedNodeTypeId }))
              ) {
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
                <MarkdownEditor
                  id="new-node-description"
                  aria-describedby="new-node-description-help"
                  placeholder="Qué debe lograr el estudiante en este hito"
                  value={value.description}
                  onValueChange={(description) =>
                    setValue((current) => ({ ...current, description }))
                  }
                />
                <FieldDescription id="new-node-description-help">
                  Admite Markdown: **negrita**, *cursiva*, listas y [enlaces](https://ejemplo.cl).{' '}
                  Puedes arrastrar un archivo .md para reemplazar el texto, previa confirmación.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-node-type">Tipo</FieldLabel>
                <NodeTypeSelect
                  id="new-node-type"
                  nodeTypes={nodeTypes}
                  value={selectedNodeTypeId}
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
        <DialogContent className="gap-5 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Tipos de nodo</DialogTitle>
            <DialogDescription>
              Organiza el contenido del roadmap con categorías, iconos y colores.
            </DialogDescription>
          </DialogHeader>
          <NodeTypesEditor
            nodeTypes={nodeTypes}
            onAdd={onCreateNodeType}
            onUpdate={onUpdateNodeType}
            onRequestDelete={onRequestDeleteNodeType}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
