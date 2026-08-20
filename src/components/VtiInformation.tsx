'use client';

import { useEffect } from 'react';

type VtiClaimValue =
  string | number | boolean | null | VtiClaimValue[] | { [key: string]: VtiClaimValue };

type Props = { claims: Record<string, VtiClaimValue> };

function formatClaim(value: VtiClaimValue) {
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export default function VtiInformation({ claims }: Props) {
  useEffect(() => {
    console.log('Información recibida desde VTI SSO:', claims);
  }, [claims]);

  return (
    <section className="rounded-[var(--radius-xl)] border border-[#dce1e8] bg-white p-6 sm:p-8">
      <div className="space-y-5">
        <h2 className="font-heading text-3xl font-semibold tracking-[-0.03em]">
          Información institucional
        </h2>
        <p className="text-[#5a6474]">Datos recibidos desde el inicio de sesión institucional.</p>
        <dl className="space-y-4">
          {Object.entries(claims).map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs font-bold tracking-[0.08em] text-[#5a6474] uppercase">
                {key}
              </dt>
              <dd className="mt-1 text-sm wrap-anywhere">{formatClaim(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
