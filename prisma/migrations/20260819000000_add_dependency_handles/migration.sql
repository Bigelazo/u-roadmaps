ALTER TABLE "Dependency"
ADD COLUMN "sourceHandle" VARCHAR(6) NOT NULL DEFAULT 'right',
ADD COLUMN "targetHandle" VARCHAR(6) NOT NULL DEFAULT 'left';
