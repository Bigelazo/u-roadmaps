ALTER TABLE "Usuario" ADD COLUMN "rut" VARCHAR(20);

CREATE UNIQUE INDEX "Usuario_rut_key" ON "Usuario"("rut");
