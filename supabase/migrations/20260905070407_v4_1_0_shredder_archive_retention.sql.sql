/*
# v4.1.0 Shredder Archive Support + Retention Rules

1. New Table: retention_rules
   - id (uuid PK)
   - name (text, not null) - label for the custom rule
   - years (integer, not null) - retention period in years
   - is_default (boolean, default false) - marks the built-in 10-year rule
   - created_at, updated_at timestamps
   - created_by (uuid, nullable)

2. physical_files new columns (all nullable, additive):
   - archived_at (timestamptz) - when the file was archived via shredder
   - archived_by (uuid) - user who performed the archive
   - archive_reason (text) - reason/remarks at time of archive
   - retention_rule_id (uuid, nullable) - which retention rule was applied
   - retention_rule_name (text, nullable) - snapshot of rule name at archive time

3. Seed the default 10-year retention rule if none exists.

4. Security
   - RLS enabled on retention_rules
   - Policies: TO authenticated for all CRUD (app has sign-in)

5. Notes
   - No existing data is changed or deleted.
   - The existing 'disposed' status and disposed_* columns remain untouched for backward compatibility.
   - Archived files use status='archived' which already exists in the status set.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'physical_files' AND column_name = 'archived_at') THEN
    ALTER TABLE physical_files ADD COLUMN archived_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'physical_files' AND column_name = 'archived_by') THEN
    ALTER TABLE physical_files ADD COLUMN archived_by uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'physical_files' AND column_name = 'archive_reason') THEN
    ALTER TABLE physical_files ADD COLUMN archive_reason text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'physical_files' AND column_name = 'retention_rule_id') THEN
    ALTER TABLE physical_files ADD COLUMN retention_rule_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'physical_files' AND column_name = 'retention_rule_name') THEN
    ALTER TABLE physical_files ADD COLUMN retention_rule_name text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS retention_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  years integer NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE retention_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_retention_rules" ON retention_rules;
CREATE POLICY "select_retention_rules" ON retention_rules FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_retention_rules" ON retention_rules;
CREATE POLICY "insert_retention_rules" ON retention_rules FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_retention_rules" ON retention_rules;
CREATE POLICY "update_retention_rules" ON retention_rules FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_retention_rules" ON retention_rules;
CREATE POLICY "delete_retention_rules" ON retention_rules FOR DELETE
  TO authenticated USING (true);

INSERT INTO retention_rules (name, years, is_default)
SELECT 'Default (10 Years)', 10, true
WHERE NOT EXISTS (SELECT 1 FROM retention_rules WHERE is_default = true);
