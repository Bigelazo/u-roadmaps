'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Menu } from '@base-ui/react/menu';
import { UsersRound } from 'lucide-react';
import { Button } from '@/shared/ui/button';

type Persona = { id: string; label: string };

export default function DevelopmentBar({
  personas,
  hideOnPersonaPage = false,
}: {
  personas: Persona[];
  hideOnPersonaPage?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function assumePersona(userId: string) {
    const response = await fetch('/api/development/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (response.ok) {
      router.replace('/academic-overview');
      router.refresh();
    }
  }

  if (hideOnPersonaPage && pathname === '/development/personas') return null;

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Cambiar perfil de desarrollo"
        render={<Button size="sm" />}
        title="Cambiar perfil de desarrollo"
      >
        <UsersRound aria-hidden="true" data-icon="inline-start" />
        Perfil
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" side="bottom" sideOffset={8}>
          <Menu.Popup className="min-w-64 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none">
            <Menu.Group>
              <Menu.GroupLabel className="px-2 py-1.5 text-xs font-bold tracking-[0.08em] text-muted-foreground">
                CAMBIAR PERFIL
              </Menu.GroupLabel>
              {personas.map((persona) => (
                <Menu.Item
                  className="flex min-h-11 w-full items-center rounded-(--radius-md) px-2 text-left text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  key={persona.id}
                  onClick={() => void assumePersona(persona.id)}
                >
                  {persona.label}
                </Menu.Item>
              ))}
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
