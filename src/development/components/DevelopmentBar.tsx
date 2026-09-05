'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from '@base-ui/react/menu';
import { UsersRound } from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(false);

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
    <Menu.Root onOpenChange={setIsOpen} open={isOpen}>
      <Menu.Trigger
        aria-label="Cambiar perfil de desarrollo"
        className="fixed bottom-4 left-4 z-30 grid size-11 place-items-center rounded-full bg-[#024ad8] text-white shadow-[0_18px_50px_rgb(18_33_58/8%)] transition-colors hover:bg-[#0e3191] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#024ad8] sm:bottom-6 sm:left-6"
        onClick={() => setIsOpen((open) => !open)}
        title="Cambiar perfil de desarrollo"
      >
        <UsersRound aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" side="top" sideOffset={12}>
          <Menu.Popup className="z-40 min-w-64 rounded-lg border border-[#dce1e8] bg-white p-2 shadow-[0_18px_50px_rgb(18_33_58/8%)] outline-none">
            <Menu.Group>
              <Menu.GroupLabel className="px-2 py-1.5 text-xs font-bold tracking-[0.08em] text-[#5a6474]">
                CAMBIAR PERFIL
              </Menu.GroupLabel>
              {personas.map((persona) => (
                <Menu.Item
                  className="flex min-h-11 w-full items-center rounded-(--radius-md) px-2 text-left text-sm outline-none data-highlighted:bg-[#f3f5f7] data-highlighted:text-[#12213a]"
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
