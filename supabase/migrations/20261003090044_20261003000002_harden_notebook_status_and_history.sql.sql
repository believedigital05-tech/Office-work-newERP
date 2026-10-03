/*
# Harden Notebook submission integrity and history snapshots

1. Submission Integrity
- Direct client inserts may create only private draft entries.
- The protected `submit_notebook_entry` function remains the only path from draft to pending.

2. History Accuracy
- The edit-history trigger now stamps editor metadata before storing the new snapshot, so each history record includes the complete resulting state.

3. Safety
- No Notebook entries or history rows are removed.
- No existing tables or modules are changed.
*/

DROP POLICY IF EXISTS "notebook_entries_insert_owner" ON public.notebook_entries;
CREATE POLICY "notebook_entries_insert_owner"
ON public.notebook_entries FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND status = 'draft');

CREATE OR REPLACE FUNCTION public.record_notebook_edit_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.last_edited_by := auth.uid();
  NEW.last_edited_at := now();
  NEW.updated_at := now();
  INSERT INTO public.notebook_entry_history (entry_id, edited_by, old_values, new_values)
  VALUES (OLD.id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$;
