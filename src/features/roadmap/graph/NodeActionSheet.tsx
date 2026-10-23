import { useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { nodeMenuActions } from '@/features/roadmap/graph/node-menu-actions';
import type { NodeActionCallbacks } from '@/features/roadmap/graph/node-action';
import type { RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import { Button } from '@/shared/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet';

const smallTouchQuery = '(max-width: 1023px) and (pointer: coarse)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(smallTouchQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSnapshot() {
  return window.matchMedia(smallTouchQuery).matches;
}

export function useNodeActionSheet() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function NodeActionSheet({
  node,
  onAction,
  onClose,
  finalFocus,
}: NodeActionCallbacks & {
  node: RoadmapFlowNode | undefined;
  onClose: () => void;
  finalFocus: () => HTMLElement | false | null;
}) {
  const [lastNode, setLastNode] = useState(node);
  if (node && node !== lastNode) setLastNode(node);
  const shownNode = node ?? lastNode;
  const actions = shownNode
    ? nodeMenuActions(
        shownNode.id,
        shownNode.data.isHidden,
        shownNode.data.isTeacherBlocked,
        onAction,
      )
    : [];

  return (
    <Sheet
      open={Boolean(node)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onOpenChangeComplete={(open) => {
        if (!open)
          requestAnimationFrame(() => {
            const target = finalFocus();
            if (target) target.focus({ preventScroll: true });
          });
      }}
    >
      <SheetContent
        id={shownNode ? `node-actions-${shownNode.id}` : undefined}
        side="bottom"
        showCloseButton={false}
        finalFocus={false}
        className="max-h-[85dvh] overflow-y-auto rounded-t-xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="pr-16">
          <SheetTitle>Menú de acciones del nodo</SheetTitle>
          <SheetDescription>{shownNode?.data.title}</SheetDescription>
        </SheetHeader>
        <SheetClose
          aria-label="Cerrar acciones"
          render={<Button variant="ghost" size="icon" className="absolute top-3 right-3" />}
        >
          <X aria-hidden="true" />
          <span className="sr-only">Cerrar acciones</span>
        </SheetClose>
        <div className="flex flex-col gap-2 px-4">
          {actions.map(({ id, label, Icon, onSelect }) => (
            <Button
              key={id}
              variant={id === 'delete' ? 'destructive' : 'ghost'}
              className="justify-start"
              onClick={onSelect}
            >
              <Icon aria-hidden="true" data-icon="inline-start" />
              {label}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
