/*
# Harden Staff Notebook metadata writes

1. Change
- Restrict direct Notebook inserts so authenticated clients can provide only work-entry content and the initial draft/pending status.

2. Protected Columns
- Creator identity, submission time, approval identity/time, edit identity/time, and database timestamps are now database-controlled.

3. Workflow Safety
- Staff submission continues through `submit_notebook_entry`.
- Admin approval continues through `approve_notebook_entry`.
- No existing Notebook rows or other tables are changed or removed.
*/

REVOKE INSERT (created_by, submitted_at, approved_by, approved_at, last_edited_by, last_edited_at, created_at, updated_at) ON public.notebook_entries FROM authenticated;
