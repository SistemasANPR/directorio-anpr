CREATE TABLE IF NOT EXISTS "representative_companies" (
  "id" serial PRIMARY KEY NOT NULL,
  "representative_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "representative_companies_representative_company_unique" UNIQUE("representative_user_id", "company_id")
);
--> statement-breakpoint
-- Normalize every recognized legacy link in one deterministic pass. Existing
-- owner links have priority, followed by sales-representative JSON and finally
-- the historical email match. row_number enforces the three-company maximum
-- during migration too: a primary plus the first two companies are retained.
WITH legacy_candidates AS (
  SELECT c."user_id" AS representative_user_id, c."id" AS company_id, true AS is_primary, 0 AS priority
  FROM "companies" c
  JOIN "users" u ON u."id" = c."user_id"
  WHERE c."user_id" IS NOT NULL

  UNION ALL

  SELECT (representative.value #>> '{}')::integer, c."id", false, 1
  FROM "companies" c
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN c."representantes_ventas" IS NOT NULL
        AND jsonb_typeof(c."representantes_ventas"::jsonb) = 'array'
      THEN c."representantes_ventas"::jsonb
      ELSE '[]'::jsonb
    END
  ) AS representative(value)
  JOIN "users" u ON u."id" = CASE
    WHEN (representative.value #>> '{}') ~ '^[0-9]+$'
    THEN (representative.value #>> '{}')::integer
    ELSE NULL
  END
  WHERE (representative.value #>> '{}') ~ '^[0-9]+$'

  UNION ALL

  SELECT u."id", c."id", false, 2
  FROM "users" u
  JOIN "companies" c ON lower(trim(u."email")) = lower(trim(c."email1"))
  WHERE trim(u."email") <> '' AND trim(c."email1") <> ''
),
deduplicated AS (
  SELECT
    representative_user_id,
    company_id,
    bool_or(is_primary) AS is_primary,
    min(priority) AS priority
  FROM legacy_candidates
  GROUP BY representative_user_id, company_id
),
ranked AS (
  SELECT *,
    row_number() OVER (
      PARTITION BY representative_user_id
      ORDER BY is_primary DESC, priority ASC, company_id ASC
    ) AS assignment_number
  FROM deduplicated
)
INSERT INTO "representative_companies" ("representative_user_id", "company_id", "is_primary")
SELECT representative_user_id, company_id, is_primary
FROM ranked
WHERE assignment_number <= 3
ON CONFLICT ("representative_user_id", "company_id")
DO UPDATE SET "is_primary" = "representative_companies"."is_primary" OR EXCLUDED."is_primary";