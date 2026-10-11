import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import type { Resource } from '@/features/roadmap/types';
import { cn } from 'cn';
import { Button, buttonVariants } from '@/shared/ui/button';
import { Item } from '@/shared/ui/item';
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
            className={buttonVariants({
              variant: 'ghost',
              size: 'icon',
              className: 'text-muted-foreground',
            })}
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
