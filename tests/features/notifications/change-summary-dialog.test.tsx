import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ChangeSummaryDialog } from '@/features/notifications/components/ChangeSummaryDialog';
import { NodeName } from '@/features/roadmap/ui/NodeName';

const evaluacion = { name: 'Evaluación', icon: 'ClipboardCheck', color: '#B42318' };
const tema = { name: 'Tema', icon: 'BookOpen', color: '#024AD8' };

function nodeNames(container: HTMLElement) {
  return [...container.querySelectorAll('[data-slot="node-name"]')].map((name) => ({
    title: name.textContent,
    color: (name.querySelector('[data-slot="node-name-icon"]') as SVGElement | null)?.style.color,
  }));
}

test('names every Node in the Change summary with its type icon and no quotes', () => {
  render(
    <ChangeSummaryDialog
      NodeName={NodeName}
      close={() => {}}
      summary={{
        courseCode: 'FI1001',
        groups: [
          {
            title: 'Control 1',
            node: { title: 'Control 1', nodeType: evaluacion },
            items: ['Nodo eliminado.'],
          },
          {
            title: 'Ruta y clasificación',
            items: [
              [
                { node: { title: 'Fuerzas', nodeType: tema } },
                ' ahora requiere ',
                { node: { title: 'Vectores', nodeType: tema } },
                '.',
              ],
            ],
          },
        ],
      }}
    />,
  );

  const dialog = screen.getByRole('dialog', { name: 'Cambios en el Roadmap de FI1001' });
  expect(within(dialog).getByRole('heading', { name: 'Control 1' })).toBeTruthy();
  expect(within(dialog).getByRole('heading', { name: 'Ruta y clasificación' })).toBeTruthy();
  expect(
    within(dialog)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['Nodo eliminado.', 'Fuerzas ahora requiere Vectores.']);
  expect(nodeNames(dialog)).toEqual([
    { title: 'Control 1', color: 'rgb(180, 35, 24)' },
    { title: 'Fuerzas', color: 'rgb(2, 74, 216)' },
    { title: 'Vectores', color: 'rgb(2, 74, 216)' },
  ]);
  expect(dialog.textContent).not.toMatch(/["“”«»]/);
});

test('still shows a plain-text summary item', () => {
  render(
    <ChangeSummaryDialog
      NodeName={NodeName}
      close={() => {}}
      summary={{
        courseCode: 'FI1001',
        groups: [{ title: 'Ruta y clasificación', items: ['Roadmap disponible.'] }],
      }}
    />,
  );

  expect(screen.getByText('Roadmap disponible.')).toBeTruthy();
});
