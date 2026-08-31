import InstitutionalCallbackForm from '@/components/app-shell/InstitutionalCallbackForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export default async function InstitutionalAccessPage({ searchParams }: Props) {
  const { jwt } = await searchParams;
  const pendingToken = typeof jwt === 'string' && jwt.trim() ? jwt : undefined;

  return (
    <main className="grid min-h-screen place-items-center bg-cloud px-6 py-16">
      <Card className="w-full max-w-md" size="sm">
        <CardHeader className="gap-2">
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.03em]">
            Acceso institucional
          </h1>
        </CardHeader>
        <CardContent>
          <p className="leading-relaxed text-muted-foreground">
            {pendingToken
              ? 'Estamos completando tu ingreso con la cuenta institucional.'
              : 'Ingresa con tu cuenta institucional U-Pasaporte.'}
          </p>
          {pendingToken ? (
            <InstitutionalCallbackForm token={pendingToken} />
          ) : (
            <form action="/api/plogin/start" method="post">
              <Button className="mt-6" size="lg" type="submit">
                Ingresar con U-Pasaporte
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
