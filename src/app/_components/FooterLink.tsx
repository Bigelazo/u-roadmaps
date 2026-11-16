import type * as React from 'react';
import Link from 'next/link';

export function FooterLink({
  href,
  children,
}: Readonly<{ href: React.ComponentProps<typeof Link>['href']; children: React.ReactNode }>) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </Link>
  );
}
