import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import type { Resource } from '@/features/roadmap/types';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import { Item, ItemMedia } from '@/shared/ui/item';
import { ResourceIcon } from '@/features/roadmap/ui/ResourceIcon';
import { dividedItemClassName } from './primitives';

type Props = {
  resources: Resource[];
  onEdit: (resource: Resource) => void;
  onDelete: (resource: Resource) => void;
};

export function ResourceList({ resources, onEdit, onDelete }: Props) {
  if (resources.length === 0) {
    return (
      <p className="border-l-2 border-border pl-3 text-sm leading-snug text-muted-foreground">
        Aún no hay recursos. Sube archivos o agrega enlaces para este hito.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border" aria-label="Recursos del nodo">
      {resources.map((item) => (
        <Item key={item.id} render={<li />} className={cn(dividedItemClassName, 'gap-2')}>
          <ItemMedia className="text-primary">
            <ResourceIcon type={item.type} />
          </ItemMedia>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{item.title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {item.type === 'FILE' ? 'Archivo' : item.type === 'VIDEO' ? 'Video' : 'Enlace'}
            </span>
          </span>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Abrir recurso ${item.title}`}
            className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ExternalLink className="size-3.5" />
          </a>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={`Editar recurso ${item.title}`}
            onClick={() => onEdit(item)}
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={`Eliminar recurso ${item.title}`}
            onClick={() => onDelete(item)}
          >
            <Trash2 />
          </Button>
        </Item>
      ))}
    </ul>
  );
}
