import Link from 'next/link';
import { Network } from 'lucide-react';
import SessionButton from './SessionButton';
import { NotificationsInbox } from '@/features/notifications';
import type { InboxIdentity } from '@/features/notifications/server';
import type { ReactNode } from 'react';

type GlobalNavigationProps = Readonly<{
  isAuthenticated: boolean;
  userName: string | null;
  inboxIdentity?: InboxIdentity | null;
  developmentTools?: ReactNode;
}>;

function navbarUserName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 3) return parts.join(' ');
  return [parts[0], ...parts.slice(-2)].join(' ');
}

export default function GlobalNavigation({
  isAuthenticated,
  userName,
  inboxIdentity,
  developmentTools,
}: GlobalNavigationProps) {
  return (
    <header className="sticky top-0 z-20 box-border min-h-16 border-b bg-background">
      <div className="mx-auto flex min-h-16 max-w-360 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 [body:has([data-page-width=full])_&]:max-w-none">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 rounded-md text-primary no-underline transition-colors outline-none hover:text-primary-deep focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
        >
          <Network aria-hidden="true" size={22} strokeWidth={2.5} />
          <span className="text-xl font-bold tracking-[-0.04em]">U-Roadmaps</span>
        </Link>
        {developmentTools}
        <div className="ml-auto flex min-w-0 items-center gap-3">
          {isAuthenticated && inboxIdentity ? (
            <NotificationsInbox identity={inboxIdentity} />
          ) : null}
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
