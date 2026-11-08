import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { NodeName } from '@/features/roadmap/ui/NodeName';

test('names a Node with its type icon in the type color and without quotes', () => {
  const view = renderToStaticMarkup(
    <NodeName
      title="Vectores"
      nodeType={{ name: 'Lectura', icon: 'BookOpen', color: '#2563eb' }}
    />,
  );

  const parsed = new DOMParser().parseFromString(view, 'text/html').body;
  expect(parsed.textContent).toBe('Vectores');
  const icon = parsed.querySelector('svg');
  expect(icon?.getAttribute('aria-hidden')).toBe('true');
  expect(icon?.getAttribute('style')).toBe('color:#2563eb');
});
