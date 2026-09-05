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
  v_existing_count int;
BEGIN
  SELECT count(*) INTO v_existing_count
  FROM file_movements
  WHERE file_id = p_file_id
    AND status = 'out'
    AND is_deleted = false;

  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'This file is already taken out. Please return it before taking it again.';
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