import { SiteFooter } from '@/app/_components/SiteFooter';

export default function SiteLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
