/*
# Add File Subject, Assessment Year (AY), and Financial Year (FY) to physical_files

1. New Columns
- `file_subject` (text, nullable) — free-text subject of the physical file.
- `assessment_year` (text, nullable) — Assessment Year dropdown value (e.g. "2026-27").
- `financial_year` (text, nullable) — Financial Year dropdown value (e.g. "2025-26").

2. Compatibility
- All three columns are nullable so existing rows continue to work without changes.
- No existing columns are removed, renamed, or retyped.
- No foreign keys or relationships are affected.

3. Security
- RLS is already enabled on physical_files; no policy changes needed
  since the existing policies already allow authenticated CRUD on all columns.
*/

ALTER TABLE physical_files
  ADD COLUMN IF NOT EXISTS file_subject text,
  ADD COLUMN IF NOT EXISTS assessment_year text,
  ADD COLUMN IF NOT EXISTS financial_year text;
