DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'physical_files' AND constraint_name = 'physical_files_archived_by_fkey'
  ) THEN
    ALTER TABLE physical_files
      ADD CONSTRAINT physical_files_archived_by_fkey
      FOREIGN KEY (archived_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;