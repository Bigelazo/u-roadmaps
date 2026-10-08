import Markdown from 'react-markdown';

export function NodeDescription({ description }: { description?: string | null }) {
  return (
    <div className="node-description leading-[1.62] wrap-break-word text-muted-foreground">
      <Markdown>{description || 'Este nodo no tiene una descripción disponible.'}</Markdown>
    </div>
  );
}
