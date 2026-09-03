import 'server-only';

import { Prisma, prisma } from '@/shared/server/db';
import type { VtiIdentity } from '@/integrations/vti/server';

export class InstitutionalIdentityConflict extends Error {
  constructor(readonly reason: 'identity-already-linked' | 'identification-mismatch') {
    super(reason);
  }
}

/** Reconciles a local User after VTI has authenticated an institutional identity. */
export async function reconcileInstitutionalUser({ rut, institutionalEmail, name }: VtiIdentity) {
  return prisma.$transaction(
    async (transaction) => {
      const [byEmail, byRut] = await Promise.all([
        transaction.user.findFirst({
          where: { institutionalEmail: { equals: institutionalEmail, mode: 'insensitive' } },
        }),
        transaction.user.findUnique({ where: { rut } }),
      ]);
      if (byEmail && byRut && byEmail.id !== byRut.id) {
        throw new InstitutionalIdentityConflict('identity-already-linked');
      }
      if (byEmail?.rut && byEmail.rut !== rut) {
        throw new InstitutionalIdentityConflict('identification-mismatch');
      }

      const existing = byEmail ?? byRut;
      if (!existing) {
        return transaction.user.create({
          data: { name, institutionalEmail, rut },
        });
      }
      return transaction.user.update({
        where: { id: existing.id },
        data: {
          ...(existing.name !== name ? { name } : {}),
          ...(existing.rut ? {} : { rut }),
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
