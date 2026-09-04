ALTER TABLE "NodeType" ADD COLUMN "icon" VARCHAR(64);

UPDATE "NodeType"
SET
  "icon" = CASE
    WHEN "isPredefined" = true AND "name" = 'Contenido' THEN 'BookOpen'
    WHEN "isPredefined" = true AND "name" = 'Evaluación' THEN 'ClipboardCheck'
    WHEN "isPredefined" = true AND "name" = 'Material extra' THEN 'LibraryBig'
    ELSE 'Shapes'
  END,
  "color" = CASE
    WHEN UPPER("color") IN (
      '#024AD8', '#1467A8', '#1476C9', '#356373', '#00758A', '#007C75', '#287A3D', '#176245',
      '#687520', '#906800', '#BD5800', '#FF5050', '#C9362B', '#B42355', '#C52F73', '#AD2680',
      '#7540B8', '#5F3DC4', '#3F51B5', '#56616F'
    ) THEN UPPER("color")
    ELSE '#56616F'
  END;

ALTER TABLE "NodeType" ALTER COLUMN "icon" SET NOT NULL;
ALTER TABLE "NodeType" DROP CONSTRAINT "NodeType_color_check";
ALTER TABLE "NodeType" ADD CONSTRAINT "NodeType_color_check" CHECK ("color" IN (
  '#024AD8', '#1467A8', '#1476C9', '#356373', '#00758A', '#007C75', '#287A3D', '#176245',
  '#687520', '#906800', '#BD5800', '#FF5050', '#C9362B', '#B42355', '#C52F73', '#AD2680',
  '#7540B8', '#5F3DC4', '#3F51B5', '#56616F'
));
