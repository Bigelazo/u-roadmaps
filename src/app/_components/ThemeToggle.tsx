'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useState } from 'react';
import { switchTheme } from '@/shared/client/theme/theme-transition';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { oppositeTheme, themeCookie, type Theme } from '@/shared/theme-preference';

const actionLabels: Record<Theme, string> = {
  light: 'Cambiar a tema oscuro',
  dark: 'Cambiar a tema claro',
};

function storeTheme(theme: Theme) {
  document.cookie = themeCookie(theme, window.location.protocol === 'https:');
}

export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setTheme] = useState(initialTheme);

  const toggle = () => {
    const next = oppositeTheme(theme);
    setTheme(next);
    storeTheme(next);
    switchTheme(next);
  };

  const label = actionLabels[theme];

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon" aria-label={label} onClick={toggle} />}
      >
        {theme === 'dark' ? (
          <SunIcon className="size-5" aria-hidden="true" />
        ) : (
          <MoonIcon className="size-5" aria-hidden="true" />
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
