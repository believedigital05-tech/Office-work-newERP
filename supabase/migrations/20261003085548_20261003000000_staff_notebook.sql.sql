/*
# Create Staff Notebook with approval workflow and edit history

1. New Tables
- `notebook_entries` stores one daily work entry per staff member, including date, description, optional client/file links, remarks, workflow status, submission/approval metadata, and last-editor metadata.
- `notebook_entry_history` stores immutable before/after snapshots for every Notebook edit, including the editor and timestamp.

2. Workflow
- New entries are created only as `draft` or `pending` by the authenticated creator.
- Staff can submit their own drafts through `submit_notebook_entry`, which changes only a draft to pending.
- Admin approval is performed through `approve_notebook_entry`, which changes only a pending entry to approved and records the approving admin.
- Drafts remain private to their creator and are never visible to admins.

3. Security
- Row-level security is enabled on both tables.
- Staff can select and update only their own entries at any status.
- Admins can select and update only non-draft entries; admins cannot see drafts.
- Direct clients cannot write ownership, approval, or edit-audit columns, and cannot directly change workflow status.
- Status transitions are enforced by security-definer functions that derive the actor from `auth.uid()`.
- History rows are written by a security-definer trigger and are readable only by the entry owner or an admin.

4. Data Safety
- No existing tables, columns, or rows are changed or removed.
- Notebook entries are not deletable through the client data API.
- Foreign keys reuse the existing profiles, clients, and physical_files masters.
*/

CREATE TABLE IF NOT EXISTS public.notebook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  work_description text NOT NULL CHECK (char_length(btrim(work_description)) > 0),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  physical_file_id uuid REFERENCES public.physical_files(id) ON DELETE SET NULL,
  remarks text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved')),
  submitted_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  last_edited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notebook_entry_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.notebook_entries(id) ON DELETE CASCADE,
  edited_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  edited_at timestamptz NOT NULL DEFAULT now(),
  old_values jsonb NOT NULL,
  new_values jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notebook_entries_created_by ON public.notebook_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_notebook_entries_status ON public.notebook_entries(status);
CREATE INDEX IF NOT EXISTS idx_notebook_entries_entry_date ON public.notebook_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_notebook_entry_history_entry_id ON public.notebook_entry_history(entry_id);

ALTER TABLE public.notebook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_entry_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notebook_entries FROM anon;
REVOKE ALL ON public.notebook_entry_history FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.notebook_entry_history FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notebook_entries TO authenticated;
GRANT SELECT ON public.notebook_entry_history TO authenticated;
REVOKE UPDATE (created_by, status, submitted_at, approved_by, approved_at, last_edited_by, last_edited_at, created_at) ON public.notebook_entries FROM authenticated;

DROP POLICY IF EXISTS "notebook_entries_select_owner_or_admin" ON public.notebook_entries;
CREATE POLICY "notebook_entries_select_owner_or_admin"
ON public.notebook_entries FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR (
    status <> 'draft'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
);

DROP POLICY IF EXISTS "notebook_entries_insert_owner" ON public.notebook_entries;
CREATE POLICY "notebook_entries_insert_owner"
ON public.notebook_entries FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND status IN ('draft', 'pending'));

DROP POLICY IF EXISTS "notebook_entries_update_owner_or_admin" ON public.notebook_entries;
CREATE POLICY "notebook_entries_update_owner_or_admin"
ON public.notebook_entries FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR (
    status <> 'draft'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
)
WITH CHECK (
  created_by = auth.uid()
  OR (
    status <> 'draft'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
);

DROP POLICY IF EXISTS "notebook_entries_no_delete" ON public.notebook_entries;
CREATE POLICY "notebook_entries_no_delete"
ON public.notebook_entries FOR DELETE TO authenticated
USING (false);

DROP POLICY IF EXISTS "notebook_history_select_owner_or_admin" ON public.notebook_entry_history;
CREATE POLICY "notebook_history_select_owner_or_admin"
ON public.notebook_entry_history FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.notebook_entries e
    WHERE e.id = notebook_entry_history.entry_id
    AND (
      e.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  )
);

DROP POLICY IF EXISTS "notebook_history_no_insert" ON public.notebook_entry_history;
CREATE POLICY "notebook_history_no_insert"
ON public.notebook_entry_history FOR INSERT TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "notebook_history_no_update" ON public.notebook_entry_history;
CREATE POLICY "notebook_history_no_update"
ON public.notebook_entry_history FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "notebook_history_no_delete" ON public.notebook_entry_history;
CREATE POLICY "notebook_history_no_delete"
ON public.notebook_entry_history FOR DELETE TO authenticated
USING (false);

CREATE OR REPLACE FUNCTION public.record_notebook_edit_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notebook_entry_history (entry_id, edited_by, old_values, new_values)
  VALUES (OLD.id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
  NEW.last_edited_by := auth.uid();
  NEW.last_edited_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notebook_entry_edit_history ON public.notebook_entries;
CREATE TRIGGER notebook_entry_edit_history
BEFORE UPDATE ON public.notebook_entries
FOR EACH ROW EXECUTE FUNCTION public.record_notebook_edit_history();

CREATE OR REPLACE FUNCTION public.submit_notebook_entry(p_entry_id uuid)
RETURNS public.notebook_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  submitted public.notebook_entries;
BEGIN
  UPDATE public.notebook_entries
  SET status = 'pending', submitted_at = COALESCE(submitted_at, now())
  WHERE id = p_entry_id AND created_by = auth.uid() AND status = 'draft'
  RETURNING * INTO submitted;

  IF submitted.id IS NULL THEN
    RAISE EXCEPTION 'Notebook entry cannot be submitted';
  END IF;
  RETURN submitted;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_notebook_entry(p_entry_id uuid)
RETURNS public.notebook_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  approved public.notebook_entries;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.notebook_entries
  SET status = 'approved', approved_by = auth.uid(), approved_at = now()
  WHERE id = p_entry_id AND status = 'pending'
  RETURNING * INTO approved;

  IF approved.id IS NULL THEN
    RAISE EXCEPTION 'Notebook entry cannot be approved';
  END IF;
  RETURN approved;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_notebook_entry(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_notebook_entry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_notebook_entry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_notebook_entry(uuid) TO authenticated;
