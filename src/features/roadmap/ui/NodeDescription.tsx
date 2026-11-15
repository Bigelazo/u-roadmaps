import Markdown, { type Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const remarkPlugins: Options['remarkPlugins'] = [[remarkGfm, { singleTilde: false }]];

export function NodeDescription({ description }: { description?: string | null }) {
  return (
    <div className="node-description leading-[1.62] wrap-break-word text-muted-foreground">
      <Markdown remarkPlugins={remarkPlugins}>
        {description || 'Este nodo no tiene una descripción disponible.'}
      </Markdown>
    </div>
  );
}
