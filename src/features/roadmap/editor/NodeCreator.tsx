'use client';

import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip';

import { useRef, useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { AnimatePresence, motion } from 'motion/react';
import { CircleAlert, CirclePlus, Plus, Shapes } from 'lucide-react';
import type { RoadmapDto } from '@/features/roadmap/types';
import { Button } from '@/shared/ui/button';
import { cn } from 'cn';
import { Spinner } from '@/shared/ui/spinner';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { FieldGroup } from '@/shared/ui/field';
import { NodeFullscreenDialog } from '@/features/roadmap/ui/NodeFullscreenDialog';
import { NodeContentFields, NodeDescriptionField } from './NodeContentFields';
import styles from './NodeCreator.module.css';
import { NodeTypesEditor } from './NodeTypesEditor';
import { StudentAccessField } from './StudentAccessField';
import {
  composerHasContent,
  STAGED_RESOURCE_COMPOSER_ID,
  StagedResources,
  type StagedResourceComposer,
} from './StagedResources';
import {
  CREATE_NODE_MENU_ITEM_LABEL,
  NODE_TYPES_MENU_ITEM_LABEL,
  type NodeCreationProgress,
  type NodeInput,
  type NodeTypeInput,
  type StagedResource,
} from './types';

const MotionButton = motion.create(Button);

const NODE_CONTENT_PLACEHOLDER = 'Explica el contenido, la actividad o la evaluación de este nodo';
const MISSING_TITLE_ERROR = 'Escribe un título para el nodo.';
const CREATION_FAILURE = 'No se pudo crear el nodo. Tu borrador se mantiene; intenta de nuevo.';
const UNSAVED_RESOURCE =
  'Agrega o descarta el recurso que estás preparando antes de crear el nodo.';
const CREATE_NODE_FORM_ID = 'create-node-form';

function creatingLabel(progress: NodeCreationProgress | null) {
  return progress ? `Subiendo recursos ${progress.current} de ${progress.total}…` : 'Creando…';
}

type Props = {
  nodeTypes: RoadmapDto['nodeTypes'];
  nodes?: readonly { nodeTypeId: string }[];
  onSubmit: (
    node: NodeInput,
    resources: readonly StagedResource[],
    onProgress: (progress: NodeCreationProgress) => void,
  ) => Promise<boolean>;
  onCreateNodeType: (nodeType: NodeTypeInput) => Promise<boolean>;
  onUpdateNodeType: (nodeTypeId: string, nodeType: NodeTypeInput) => Promise<boolean>;
  onRequestDeleteNodeType: (nodeType: RoadmapDto['nodeTypes'][number]) => void;
};

export function NodeCreator({
  nodeTypes,
  nodes,
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
  const [resources, setResources] = useState<readonly StagedResource[]>([]);
  const [resourceComposer, setResourceComposer] = useState<StagedResourceComposer | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState<NodeCreationProgress | null>(null);
  const [isTitleMissing, setIsTitleMissing] = useState(false);
  const [creationFailure, setCreationFailure] = useState<string | null>(null);
  const hasNodeTypes = nodeTypes.length > 0;
  const titleError = isTitleMissing && !value.title.trim() ? MISSING_TITLE_ERROR : undefined;

  async function createNode() {
    if (isCreating || !selectedNodeTypeId) return;
    if (!value.title.trim()) {
      setIsTitleMissing(true);
      document.getElementById('new-node-title')?.focus();
      return;
    }
    if (composerHasContent(resourceComposer)) {
      setCreationFailure(UNSAVED_RESOURCE);
      (
        document.getElementById(`${STAGED_RESOURCE_COMPOSER_ID}-title`) ??
        document.getElementById(`${STAGED_RESOURCE_COMPOSER_ID}-file`)
      )?.focus();
      return;
    }
    setCreationFailure(null);
    setResourceComposer(null);
    setIsCreating(true);
    try {
      if (await onSubmit({ ...value, nodeTypeId: selectedNodeTypeId }, resources, setProgress)) {
        setValue((current) => ({ ...current, title: '', description: '' }));
        setResources([]);
        setIsTitleMissing(false);
        setIsNodeDialogOpen(false);
      } else {
        setCreationFailure(CREATION_FAILURE);
      }
    } catch {
      setCreationFailure(CREATION_FAILURE);
    } finally {
      setIsCreating(false);
      setProgress(null);
    }
  }
  const selectedNodeTypeId = nodeTypes.some((type) => type.id === value.nodeTypeId)
    ? value.nodeTypeId
    : (nodeTypes[0]?.id ?? '');

  return (
    <div ref={menuLayerRef} className={styles.menuLayer}>
      <Menu.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Tooltip>
          <TooltipTrigger
            delay={150}
            render={
              <Menu.Trigger
                data-toast-anchor=""
                aria-label="Crear en el mapa"
                render={
                  <MotionButton
                    type="button"
                    size="icon-lg"
                    className={cn(styles.trigger, isMenuOpen && styles.triggerOpen)}
                    whileHover={{ scale: 1.06, y: -2 }}
                    whileTap={{ scale: 0.92, y: 0 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  />
                }
              >
                <motion.span
                  aria-hidden="true"
                  className={styles.menuIcon}
                  initial={false}
                  animate={{ rotate: isMenuOpen ? 135 : 0 }}
                  transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Plus />
                </motion.span>
              </Menu.Trigger>
            }
          />
          <TooltipContent>Crear en el mapa</TooltipContent>
        </Tooltip>
        <AnimatePresence>
          {isMenuOpen && (
            <Menu.Portal container={menuLayerRef} keepMounted>
              <Menu.Positioner
                data-toast-obstacle=""
                align="end"
                side="top"
                sideOffset={14}
                className={styles.positioner}
              >
                <Menu.Popup
                  className={styles.menu}
                  render={
                    <motion.div
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.14 } }}
                    />
                  }
                >
                  <Menu.Group className={styles.actions}>
                    <Menu.Item
                      className={styles.menuItem}
                      aria-label={NODE_TYPES_MENU_ITEM_LABEL}
                      render={
                        <motion.div
                          initial={{ opacity: 0, y: 124, scale: 0.72 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{
                            opacity: 0,
                            y: 124,
                            scale: 0.72,
                            transition: { duration: 0.14, delay: 0 },
                          }}
                          transition={{ duration: 0.24, delay: 0.035, ease: [0.16, 1, 0.3, 1] }}
                        />
                      }
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsNodeTypesDialogOpen(true);
                      }}
                    >
                      <span className={styles.actionLabel}>Tipos de nodo</span>
                      <span className={styles.actionIcon} aria-hidden="true">
                        <Shapes />
                      </span>
                    </Menu.Item>
                    <Menu.Item
                      className={cn(styles.menuItem, styles.primaryAction)}
                      render={
                        <motion.div
                          initial={{ opacity: 0, y: 64, scale: 0.72 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{
                            opacity: 0,
                            y: 64,
                            scale: 0.72,
                            transition: { duration: 0.12, delay: 0 },
                          }}
                          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                        />
                      }
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsTitleMissing(false);
                        setCreationFailure(null);
                        setIsNodeDialogOpen(true);
                      }}
                    >
                      <span className={styles.actionLabel}>{CREATE_NODE_MENU_ITEM_LABEL}</span>
                      <span className={styles.actionIcon} aria-hidden="true">
                        <CirclePlus />
                      </span>
                    </Menu.Item>
                  </Menu.Group>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          )}
        </AnimatePresence>
      </Menu.Root>
      <Dialog
        open={isNodeDialogOpen}
        onOpenChange={(open) => {
          if (!open && isCreating) return;
          setIsNodeDialogOpen(open);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        >
          <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
            <DialogTitle>Crear nodo</DialogTitle>
          </DialogHeader>
          <div
            data-slot="dialog-body"
            aria-busy={isCreating || undefined}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 [--markdown-editor-max-height:min(24rem,45dvh)]"
          >
            <FieldGroup>
              <NodeContentFields
                idPrefix="new-node"
                nodeTypes={nodeTypes}
                value={{ ...value, nodeTypeId: selectedNodeTypeId }}
                onChange={(patch) => setValue((current) => ({ ...current, ...patch }))}
                titlePlaceholder="Ej. Repasar límites"
                titleError={titleError}
                titleForm={CREATE_NODE_FORM_ID}
                descriptionPlaceholder={NODE_CONTENT_PLACEHOLDER}
                descriptionAction={
                  <NodeFullscreenDialog
                    title={value.title.trim() || 'Nuevo nodo'}
                    triggerLabel="Editar contenido en pantalla completa"
                  >
                    <div className="[--markdown-editor-max-height:calc(100dvh-12.25rem+2px)] [--markdown-editor-min-height:calc(100dvh-12.25rem)]">
                      <NodeDescriptionField
                        idPrefix="new-node-fullscreen"
                        value={{ ...value, nodeTypeId: selectedNodeTypeId }}
                        onChange={(patch) => setValue((current) => ({ ...current, ...patch }))}
                        placeholder={NODE_CONTENT_PLACEHOLDER}
                      />
                    </div>
                  </NodeFullscreenDialog>
                }
              />
              <StagedResources
                resources={resources}
                composer={resourceComposer}
                disabled={isCreating}
                onComposerChange={(composer) => {
                  setResourceComposer(composer);
                  if (!composerHasContent(composer)) setCreationFailure(null);
                }}
                onAdd={(resource) => {
                  setResources((current) => [...current, resource]);
                  setCreationFailure(null);
                }}
                onRemove={(resourceId) =>
                  setResources((current) =>
                    current.filter((resource) => resource.id !== resourceId),
                  )
                }
              />
              <StudentAccessField
                idPrefix="new-node"
                isVisible={value.isVisible}
                disabled={isCreating}
                onVisibleChange={(isVisible) => setValue((current) => ({ ...current, isVisible }))}
              />
            </FieldGroup>
            {!hasNodeTypes && (
              <p className="mt-4 text-sm text-destructive">
                Crea primero un tipo de nodo para poder agregar contenido.
              </p>
            )}
          </div>
          <form
            id={CREATE_NODE_FORM_ID}
            noValidate
            className="shrink-0"
            onSubmit={(event) => {
              event.preventDefault();
              void createNode();
            }}
          >
            <DialogFooter className="mx-0 mb-0 px-6 sm:items-center">
              <DialogClose
                render={<Button type="button" variant="outline" disabled={isCreating} />}
              >
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={!hasNodeTypes || isCreating}>
                {isCreating ? (
                  <Spinner aria-hidden="true" data-icon="inline-start" role={undefined} />
                ) : null}
                {isCreating ? creatingLabel(progress) : 'Crear nodo'}
              </Button>
              {creationFailure ? (
                <p
                  role="alert"
                  className="flex items-start gap-1.5 text-sm text-destructive sm:order-first sm:mr-auto"
                >
                  <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {creationFailure}
                </p>
              ) : null}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <NodeTypesEditor
        open={isNodeTypesDialogOpen}
        onOpenChange={setIsNodeTypesDialogOpen}
        nodeTypes={nodeTypes}
        nodes={nodes}
        onAdd={onCreateNodeType}
        onUpdate={onUpdateNodeType}
        onRequestDelete={onRequestDeleteNodeType}
      />
    </div>
  );
}
