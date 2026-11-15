'use client';

import { useState } from 'react';
import { CircleAlert, CirclePlus, Shapes } from 'lucide-react';
import type { RoadmapDto } from '@/features/roadmap/types';
import type { PlacementRecovery } from '@/features/roadmap/session/placement-recovery';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import { SpeedDial } from '@/shared/ui/speed-dial';
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
  type StagedResourceComposer,
} from './staged-resource-composer';
import { StagedResources } from './StagedResources';
import {
  CREATE_NODE_MENU_ITEM_LABEL,
  NODE_TYPES_MENU_ITEM_LABEL,
  type NodeCreationProgress,
  type NodeInput,
  type NodeTypeInput,
  type StagedResource,
} from './types';

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
  creationRecovery?: PlacementRecovery | null;
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
  creationRecovery,
  onSubmit,
  onCreateNodeType,
  onUpdateNodeType,
  onRequestDeleteNodeType,
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
  const [resources, setResources] = useState<readonly StagedResource[]>([]);
  const [resourceComposer, setResourceComposer] = useState<StagedResourceComposer | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState<NodeCreationProgress | null>(null);
  const [isTitleMissing, setIsTitleMissing] = useState(false);
  const [creationFailure, setCreationFailure] = useState<string | null>(null);
  const hasNodeTypes = nodeTypes.length > 0;
  const titleError = isTitleMissing && !value.title.trim() ? MISSING_TITLE_ERROR : undefined;
  const shownFailure = creationRecovery?.message ?? creationFailure;

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
    <div className={styles.creator}>
      <SpeedDial
        label="Crear en el mapa"
        open={isMenuOpen}
        onOpenChange={setIsMenuOpen}
        actionsFromTopToTrigger={[
          {
            id: 'node-types',
            label: 'Tipos de nodo',
            accessibleLabel: NODE_TYPES_MENU_ITEM_LABEL,
            icon: <Shapes />,
            onSelect: () => {
              setIsMenuOpen(false);
              setIsNodeTypesDialogOpen(true);
            },
          },
          {
            id: 'create-node',
            label: CREATE_NODE_MENU_ITEM_LABEL,
            icon: <CirclePlus />,
            onSelect: () => {
              setIsMenuOpen(false);
              setIsTitleMissing(false);
              setCreationFailure(null);
              setIsNodeDialogOpen(true);
            },
          },
        ]}
      />
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
            <fieldset disabled={isCreating || Boolean(creationRecovery)} className="min-w-0">
              <FieldGroup>
                <NodeContentFields
                  disabled={isCreating || Boolean(creationRecovery)}
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
                          disabled={isCreating || Boolean(creationRecovery)}
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
                  onVisibleChange={(isVisible) =>
                    setValue((current) => ({ ...current, isVisible }))
                  }
                />
              </FieldGroup>
            </fieldset>
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
                {isCreating
                  ? creatingLabel(progress)
                  : creationRecovery?.kind === 'uncertain-creation'
                    ? 'Reenviar creación'
                    : creationRecovery
                      ? 'Continuar creación'
                      : 'Crear nodo'}
              </Button>
              {shownFailure ? (
                <p
                  role="alert"
                  className="flex items-start gap-1.5 text-sm text-destructive sm:order-first sm:mr-auto"
                >
                  <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {shownFailure}
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
