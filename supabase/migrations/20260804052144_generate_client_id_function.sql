/*
# Add generate_client_id function

## Purpose
PostgREST does not expose pg_catalog.nextval, so the client cannot call it via supabase.rpc().
This wrapper function lives in the public schema and is callable by authenticated users.
It generates a sequential client ID like "LAC-0001".
*/

CREATE OR REPLACE FUNCTION generate_client_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 'LAC-' || lpad(nextval('client_id_seq')::text, 4, '0');
$$;

GRANT EXECUTE ON FUNCTION generate_client_id() TO authenticated;
