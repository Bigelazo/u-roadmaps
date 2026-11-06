import Link from 'next/link';

export function ThirdPartyLicensesLink() {
  return (
    <Link
      href="/third-party-licenses"
      className="inline-flex min-h-11 items-center underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      Licencias de terceros
    </Link>
  );
}
