import Link from 'next/link';
import { Network } from 'lucide-react';
import SessionButton from '@/components/app-shell/SessionButton';

type GlobalNavigationProps = Readonly<{
  isAuthenticated: boolean;
}>;

export default function GlobalNavigation({ isAuthenticated }: GlobalNavigationProps) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background">
      <div className="mx-auto flex min-h-16 max-w-360 items-center px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 rounded-md text-primary no-underline transition-colors outline-none hover:text-primary-deep focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
        >
          <Network aria-hidden="true" size={22} strokeWidth={2.5} />
          <span className="text-xl font-bold tracking-[-0.04em]">U-Roadmaps</span>
        </Link>
        <div className="ml-auto">
          <SessionButton isAuthenticated={isAuthenticated} />
        </div>
      </div>
    </header>
  );
}
