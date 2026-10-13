import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

test('vertical Tabs select and focus the next panel with ArrowDown', async () => {
  const user = userEvent.setup();
  render(
    <Tabs orientation="vertical" defaultValue="file">
      <TabsList activateOnFocus aria-label="Tipo de recurso">
        <TabsTrigger value="file">Archivo</TabsTrigger>
        <TabsTrigger value="link">Enlace</TabsTrigger>
      </TabsList>
      <TabsContent value="file">Sube un archivo</TabsContent>
      <TabsContent value="link">Agrega un enlace</TabsContent>
    </Tabs>,
  );
  await user.click(screen.getByRole('tab', { name: 'Archivo' }));
  await user.keyboard('{ArrowDown}');

  const link = screen.getByRole('tab', { name: 'Enlace' });
  expect(link.matches(':focus')).toBe(true);
  expect(link.getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('tabpanel', { name: 'Enlace' }).textContent).toBe('Agrega un enlace');
});
