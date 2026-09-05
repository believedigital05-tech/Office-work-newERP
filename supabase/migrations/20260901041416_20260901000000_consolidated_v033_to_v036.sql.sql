/*
# Consolidated Update v0.3.3 to v0.3.6

## Changes:
1. financial_years master table (configurable FY with active/sort_order)
2. assessment_years master table (configurable AY with active/sort_order)
3. retention_years setting on company_settings (default 8)
4. 'disposed' status added to physical_files
5. disposed_at, disposed_by, dispose_reason columns on physical_files
6. Updated take_file RPC with race-condition protection (re-checks file status)
7. Seed FY 2000-01 through 2039-40 and AY 2001-02 through 2040-41
*/

-- ============================
-- FINANCIAL YEARS MASTER
-- ============================
CREATE TABLE IF NOT EXISTS financial_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text UNIQUE NOT NULL,
  start_year integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE financial_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_years_select" ON financial_years;
CREATE POLICY "financial_years_select" ON financial_years FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "financial_years_insert" ON financial_years;
CREATE POLICY "financial_years_insert" ON financial_years FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "financial_years_update" ON financial_years;
CREATE POLICY "financial_years_update" ON financial_years FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "financial_years_delete" ON financial_years;
CREATE POLICY "financial_years_delete" ON financial_years FOR DELETE TO authenticated USING (true);

-- ============================
-- ASSESSMENT YEARS MASTER
-- ============================
CREATE TABLE IF NOT EXISTS assessment_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text UNIQUE NOT NULL,
  start_year integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE assessment_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assessment_years_select" ON assessment_years;
CREATE POLICY "assessment_years_select" ON assessment_years FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "assessment_years_insert" ON assessment_years;
CREATE POLICY "assessment_years_insert" ON assessment_years FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "assessment_years_update" ON assessment_years;
CREATE POLICY "assessment_years_update" ON assessment_years FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "assessment_years_delete" ON assessment_years;
CREATE POLICY "assessment_years_delete" ON assessment_years FOR DELETE TO authenticated USING (true);

-- ============================
-- SEED FINANCIAL YEARS (2000-01 through 2039-40)
-- ============================
DO $$
DECLARE
  i integer;
  fy_label text;
BEGIN
  FOR i IN 2000..2039 LOOP
    fy_label := i::text || '-' || lpad((i + 1)::text, 2, '0');
    INSERT INTO financial_years (label, start_year, is_active, sort_order)
    VALUES (fy_label, i, true, i)
    ON CONFLICT (label) DO NOTHING;
  END LOOP;
END $$;

-- ============================
-- SEED ASSESSMENT YEARS (2001-02 through 2040-41)
-- ============================
DO $$
DECLARE
  i integer;
  ay_label text;
BEGIN
  FOR i IN 2001..2040 LOOP
    ay_label := i::text || '-' || lpad((i + 1)::text, 2, '0');
    INSERT INTO assessment_years (label, start_year, is_active, sort_order)
    VALUES (ay_label, i, true, i)
    ON CONFLICT (label) DO NOTHING;
  END LOOP;
END $$;

-- ============================
-- RETENTION YEARS SETTING
-- ============================
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS retention_years integer NOT NULL DEFAULT 8;

-- ============================
-- DISPOSED STATUS + DISPOSAL COLUMNS ON physical_files
-- ============================
ALTER TABLE physical_files
  ADD COLUMN IF NOT EXISTS disposed_at timestamptz,
  ADD COLUMN IF NOT EXISTS disposed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS dispose_reason text;

-- Update status CHECK to include 'disposed'
ALTER TABLE physical_files DROP CONSTRAINT IF EXISTS physical_files_status_check;
ALTER TABLE physical_files ADD CONSTRAINT physical_files_status_check
  CHECK (status IN ('available', 'in_use', 'sent_outside', 'archived', 'missing', 'disposed'));

-- ============================
-- UPDATE take_file RPC: race-condition protection
-- ============================
CREATE OR REPLACE FUNCTION take_file(
  p_file_id uuid,
  p_taken_by_id uuid,
  p_taken_date timestamptz,
  p_purpose text DEFAULT NULL,
  p_expected_return_date timestamptz DEFAULT NULL,
  p_remarks text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_movement_id text;
  v_movement uuid;
  v_result json;
  v_current_status text;
BEGIN
  -- Race-condition protection: re-check file status before creating movement
  SELECT status INTO v_current_status FROM physical_files WHERE id = p_file_id AND is_deleted = false;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'File not found or has been deleted';
  END IF;
  IF v_current_status <> 'available' THEN
    RAISE EXCEPTION 'This file is no longer available. Please refresh and select another file.';
  END IF;

  v_movement_id := 'MV' || lpad(extract(epoch from now())::bigint::text, 10, '0');

  INSERT INTO file_movements (
    movement_id, file_id, taken_by_id, purpose,
    taken_date, expected_return_date, remarks,
    status, created_by, is_deleted
  ) VALUES (
    v_movement_id, p_file_id, p_taken_by_id, p_purpose,
    p_taken_date, p_expected_return_date, p_remarks,
    'out', p_created_by, false
  ) RETURNING id INTO v_movement;

  UPDATE physical_files
  SET status = 'in_use',
      current_holder_id = p_taken_by_id,
      last_movement_date = now(),
      updated_at = now()
  WHERE id = p_file_id;

  SELECT json_build_object(
    'id', fm.id,
    'movement_id', fm.movement_id,
    'file_id', fm.file_id,
    'status', fm.status,
    'taken_date', fm.taken_date
  ) INTO v_result
  FROM file_movements fm
  WHERE fm.id = v_movement;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION take_file TO authenticated;

-- return_file stays the same (already correct from original migration)

-- ============================
-- INDEXES for performance
-- ============================
CREATE INDEX IF NOT EXISTS idx_physical_files_cabinet_id ON physical_files(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_physical_files_assessment_year ON physical_files(assessment_year);
CREATE INDEX IF NOT EXISTS idx_physical_files_financial_year ON physical_files(financial_year);
