'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
} from '@/shared/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip';
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
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              aria-label="Cambiar perfil de desarrollo"
              render={<Button size="sm" />}
            >
              <UsersRound aria-hidden="true" data-icon="inline-start" />
              Perfil
            </DropdownMenuTrigger>
          }
        />
        <TooltipContent>Cambiar perfil de desarrollo</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start" sideOffset={8} className="min-w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>CAMBIAR PERFIL</DropdownMenuLabel>
          {personas.map((persona) => (
            <DropdownMenuItem
              className="min-h-11"
              key={persona.id}
              onClick={() => void assumePersona(persona.id)}
            >
              {persona.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
