import Link from 'next/link';
import { Network } from 'lucide-react';
import SessionButton from '@/components/app-shell/SessionButton';

type GlobalNavigationProps = Readonly<{
  isAuthenticated: boolean;
  userName: string | null;
}>;

function navbarUserName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 3) return parts.join(' ');
  return [parts[0], ...parts.slice(-2)].join(' ');
}

export default function GlobalNavigation({ isAuthenticated, userName }: GlobalNavigationProps) {
  return (
    <header className="sticky top-0 z-20 box-border h-16 border-b bg-background">
      <div className="mx-auto flex h-full max-w-360 items-center px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 rounded-md text-primary no-underline transition-colors outline-none hover:text-primary-deep focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
        >
          <Network aria-hidden="true" size={22} strokeWidth={2.5} />
          <span className="text-xl font-bold tracking-[-0.04em]">U-Roadmaps</span>
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          {userName ? (
            <span
              className="max-w-44 truncate text-sm font-medium text-foreground sm:max-w-72"
              title={userName}
            >
              {navbarUserName(userName)}
            </span>
          ) : null}
          <SessionButton isAuthenticated={isAuthenticated} />
        </div>
      </div>
    </header>
  );
}
