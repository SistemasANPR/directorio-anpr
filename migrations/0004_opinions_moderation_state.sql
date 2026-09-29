UPDATE "opinions"
SET "estado" = 'aprobada'
WHERE "estado" IS NULL OR btrim("estado") = '';
--> statement-breakpoint
ALTER TABLE "opinions" ALTER COLUMN "estado" SET DEFAULT 'pendiente';
--> statement-breakpoint
ALTER TABLE "opinions" ALTER COLUMN "estado" SET NOT NULL;