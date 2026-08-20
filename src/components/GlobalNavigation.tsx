import Link from 'next/link';
import { Network } from 'lucide-react';
import SessionButton from '@/components/SessionButton';

export default function GlobalNavigation({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#dce1e8] bg-white">
      <div className="mx-auto flex min-h-16 max-w-[1440px] items-center px-6">
        <Link href="/" className="flex items-center gap-2 text-[#024ad8] no-underline">
          <Network size={22} strokeWidth={2.5} />
          <span className="text-xl font-bold tracking-[-0.04em]">U-Roadmaps</span>
        </Link>
        <div className="ml-auto">
          <SessionButton isAuthenticated={isAuthenticated} />
        </div>
      </div>
    </header>
  );
}
