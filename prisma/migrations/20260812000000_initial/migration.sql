CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "TipoRecurso" AS ENUM ('ARCHIVO', 'ENLACE', 'VIDEO');
CREATE TYPE "FuncionParticipacion" AS ENUM ('ESTUDIANTE', 'DOCENTE');

CREATE TABLE "Ramo" (
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "departamento" VARCHAR(200) NOT NULL,
    CONSTRAINT "Ramo_pkey" PRIMARY KEY ("codigo")
);

CREATE TABLE "Curso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ramoCodigo" VARCHAR(20) NOT NULL,
    "anio" INTEGER NOT NULL,
    "semestre" INTEGER NOT NULL,
    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Curso_academic_period_check" CHECK ("anio" > 0 AND "semestre" IN (1, 2))
);

CREATE TABLE "Roadmap" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cursoId" UUID NOT NULL,
    CONSTRAINT "Roadmap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TipoNodo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(120) NOT NULL,
    "nombreNormalizado" VARCHAR(120) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "predefinido" BOOLEAN NOT NULL DEFAULT false,
    "roadmapId" UUID,
    CONSTRAINT "TipoNodo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TipoNodo_color_check" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT "TipoNodo_scope_check" CHECK (
        ("predefinido" = true AND "roadmapId" IS NULL)
        OR ("predefinido" = false AND "roadmapId" IS NOT NULL)
    )
);

CREATE TABLE "Nodo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roadmapId" UUID NOT NULL,
    "tipoNodoId" UUID NOT NULL,
    "titulo" VARCHAR(240) NOT NULL,
    "descripcion" TEXT,
    "posX" DOUBLE PRECISION NOT NULL,
    "posY" DOUBLE PRECISION NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Nodo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Nodo_position_check" CHECK (
        "posX" < 'Infinity'::double precision AND "posX" > '-Infinity'::double precision
        AND "posY" < 'Infinity'::double precision AND "posY" > '-Infinity'::double precision
    )
);

CREATE TABLE "Dependencia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceNodeId" UUID NOT NULL,
    "targetNodeId" UUID NOT NULL,
    CONSTRAINT "Dependencia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Dependencia_self_check" CHECK ("sourceNodeId" <> "targetNodeId")
);

CREATE TABLE "Recurso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nodoId" UUID NOT NULL,
    "titulo" VARCHAR(240) NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" "TipoRecurso" NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Recurso_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(200) NOT NULL,
    "correoInstitucional" VARCHAR(320) NOT NULL,
    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Participacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuarioId" UUID NOT NULL,
    "cursoId" UUID NOT NULL,
    "funcion" "FuncionParticipacion" NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Participacion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Completacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuarioId" UUID NOT NULL,
    "nodoId" UUID NOT NULL,
    "completadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Completacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Curso_ramoCodigo_anio_semestre_key" ON "Curso"("ramoCodigo", "anio", "semestre");
CREATE INDEX "Curso_ramoCodigo_idx" ON "Curso"("ramoCodigo");
CREATE UNIQUE INDEX "Roadmap_cursoId_key" ON "Roadmap"("cursoId");
CREATE UNIQUE INDEX "TipoNodo_roadmapId_nombreNormalizado_key" ON "TipoNodo"("roadmapId", "nombreNormalizado");
CREATE INDEX "TipoNodo_predefinido_idx" ON "TipoNodo"("predefinido");
CREATE INDEX "Nodo_roadmapId_idx" ON "Nodo"("roadmapId");
CREATE INDEX "Nodo_tipoNodoId_idx" ON "Nodo"("tipoNodoId");
CREATE UNIQUE INDEX "Dependencia_sourceNodeId_targetNodeId_key" ON "Dependencia"("sourceNodeId", "targetNodeId");
CREATE INDEX "Dependencia_targetNodeId_idx" ON "Dependencia"("targetNodeId");
CREATE INDEX "Recurso_nodoId_idx" ON "Recurso"("nodoId");
CREATE UNIQUE INDEX "Usuario_correoInstitucional_key" ON "Usuario"("correoInstitucional");
CREATE UNIQUE INDEX "Participacion_usuarioId_cursoId_key" ON "Participacion"("usuarioId", "cursoId");
CREATE INDEX "Participacion_cursoId_funcion_idx" ON "Participacion"("cursoId", "funcion");
CREATE UNIQUE INDEX "Completacion_usuarioId_nodoId_key" ON "Completacion"("usuarioId", "nodoId");
CREATE INDEX "Completacion_nodoId_idx" ON "Completacion"("nodoId");

ALTER TABLE "Curso" ADD CONSTRAINT "Curso_ramoCodigo_fkey" FOREIGN KEY ("ramoCodigo") REFERENCES "Ramo"("codigo") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipoNodo" ADD CONSTRAINT "TipoNodo_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Nodo" ADD CONSTRAINT "Nodo_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Nodo" ADD CONSTRAINT "Nodo_tipoNodoId_fkey" FOREIGN KEY ("tipoNodoId") REFERENCES "TipoNodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dependencia" ADD CONSTRAINT "Dependencia_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "Nodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dependencia" ADD CONSTRAINT "Dependencia_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "Nodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recurso" ADD CONSTRAINT "Recurso_nodoId_fkey" FOREIGN KEY ("nodoId") REFERENCES "Nodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Participacion" ADD CONSTRAINT "Participacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Participacion" ADD CONSTRAINT "Participacion_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Completacion" ADD CONSTRAINT "Completacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Completacion" ADD CONSTRAINT "Completacion_nodoId_fkey" FOREIGN KEY ("nodoId") REFERENCES "Nodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION enforce_student_completion() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "Participacion" p
        JOIN "Curso" c ON c."id" = p."cursoId"
        JOIN "Roadmap" r ON r."cursoId" = c."id"
        JOIN "Nodo" n ON n."roadmapId" = r."id"
        WHERE p."usuarioId" = NEW."usuarioId"
          AND p."funcion" = 'ESTUDIANTE'
          AND p."vigente" = true
          AND n."id" = NEW."nodoId"
    ) THEN
        RAISE EXCEPTION 'Completacion requires an active student participation for the node course';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Completacion_student_check"
BEFORE INSERT OR UPDATE ON "Completacion"
FOR EACH ROW EXECUTE FUNCTION enforce_student_completion();
