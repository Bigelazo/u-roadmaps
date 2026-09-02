import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import type { Resource } from '@/lib/roadmap-types';
import { Button } from '@/shared/ui/button';

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
        <li key={item.id} className="flex items-center gap-2 py-2.5 text-sm">
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
        </li>
      ))}
    </ul>
  );
}
