import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { NodeCreator } from '@/features/roadmap/editor/NodeCreator';

test('opens the roadmap creation menu without a Base UI runtime error', async () => {
  const user = userEvent.setup();

  render(
    <NodeCreator
      nodeTypes={[]}
      onSubmit={async () => false}
      onCreateNodeType={async () => false}
      onUpdateNodeType={async () => false}
      onRequestDeleteNodeType={() => undefined}
    />,
  );

  const trigger = screen.getByRole('button', { name: 'Crear en el mapa' });
  await user.click(trigger);

  const createItem = await screen.findByRole('menuitem', { name: 'Crear nodo' });
  const manageTypesItem = await screen.findByRole('menuitem', {
    name: 'Gestionar tipos de nodo',
  });
  expect(trigger.parentElement?.contains(createItem)).toBe(true);
  expect(trigger.parentElement?.contains(manageTypesItem)).toBe(true);
});
