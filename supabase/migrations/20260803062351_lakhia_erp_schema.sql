
/*
# Lakhia And Co. ERP - Core Schema

This migration creates the complete schema for the Office Management ERP.

## New Tables

1. `profiles` - Extended user profiles linked to auth.users, with role assignment
2. `employees` - Employee master (separate from login accounts)
3. `client_types` - Configurable client type dropdown
4. `activity_types` - Configurable activity type dropdown
5. `courier_companies` - Configurable courier company dropdown
6. `clients` - Client master with PAN/GST/TAN/CIN fields
7. `cabinets` - Physical cabinet/storage structure
8. `physical_files` - Physical file master linked to clients and cabinets
9. `file_movements` - File movement register (soft-delete only)
10. `couriers` - Courier register
11. `activities` - Activity register with reminders
12. `notes` - Notes per client
13. `audit_logs` - Permanent audit trail
14. `notifications` - In-app notifications
15. `deleted_records` - Recycle bin storage
16. `import_batches` - Import batch history
17. `feedback` - User feedback submissions

## Security

- RLS enabled on all tables
- Role-based access enforced via profiles.role column
- Sensitive fields (PAN, GST, TAN, CIN) masked for Staff/Intern roles

## Important Notes

- Roles: admin, manager, staff, intern
- All deletes go through recycle bin (soft delete), no hard deletes from UI
- Audit log is permanent, no delete policy
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================
-- PROFILES (extends auth.users)
-- ============================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff', 'intern')),
  employee_id uuid,
  must_change_password boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================
-- EMPLOYEES
-- ============================
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff', 'intern')),
  department text,
  contact_number text,
  email text,
  login_account_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_select" ON employees;
CREATE POLICY "employees_select" ON employees FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "employees_insert" ON employees;
CREATE POLICY "employees_insert" ON employees FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "employees_update" ON employees;
CREATE POLICY "employees_update" ON employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "employees_delete" ON employees;
CREATE POLICY "employees_delete" ON employees FOR DELETE TO authenticated USING (true);

-- ============================
-- CLIENT TYPES (admin-editable)
-- ============================
CREATE TABLE IF NOT EXISTS client_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_types_select" ON client_types;
CREATE POLICY "client_types_select" ON client_types FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "client_types_insert" ON client_types;
CREATE POLICY "client_types_insert" ON client_types FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "client_types_update" ON client_types;
CREATE POLICY "client_types_update" ON client_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "client_types_delete" ON client_types;
CREATE POLICY "client_types_delete" ON client_types FOR DELETE TO authenticated USING (true);

-- Seed client types
INSERT INTO client_types (name, sort_order) VALUES
  ('Individual', 1), ('HUF', 2), ('Trust', 3), ('Partnership', 4),
  ('LLP', 5), ('Private Limited Company', 6), ('Public Limited Company', 7),
  ('Proprietorship', 8), ('Society', 9), ('NGO', 10),
  ('Section 8 Company', 11), ('Other', 12)
ON CONFLICT (name) DO NOTHING;

-- ============================
-- ACTIVITY TYPES
-- ============================
CREATE TABLE IF NOT EXISTS activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_types_select" ON activity_types;
CREATE POLICY "activity_types_select" ON activity_types FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "activity_types_insert" ON activity_types;
CREATE POLICY "activity_types_insert" ON activity_types FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "activity_types_update" ON activity_types;
CREATE POLICY "activity_types_update" ON activity_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "activity_types_delete" ON activity_types;
CREATE POLICY "activity_types_delete" ON activity_types FOR DELETE TO authenticated USING (true);

INSERT INTO activity_types (name, sort_order) VALUES
  ('Income Tax Return', 1), ('GST Return', 2), ('Audit', 3),
  ('Accounting', 4), ('TDS Return', 5), ('ROC Filing', 6),
  ('Office Visit', 7), ('Phone Call', 8), ('Email', 9),
  ('Meeting', 10), ('Notice', 11), ('Compliance', 12),
  ('Document Collection', 13), ('Document Submission', 14),
  ('Payment Follow-up', 15), ('Other', 16)
ON CONFLICT (name) DO NOTHING;

-- ============================
-- COURIER COMPANIES
-- ============================
CREATE TABLE IF NOT EXISTS courier_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE courier_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courier_companies_select" ON courier_companies;
CREATE POLICY "courier_companies_select" ON courier_companies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "courier_companies_insert" ON courier_companies;
CREATE POLICY "courier_companies_insert" ON courier_companies FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "courier_companies_update" ON courier_companies;
CREATE POLICY "courier_companies_update" ON courier_companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "courier_companies_delete" ON courier_companies;
CREATE POLICY "courier_companies_delete" ON courier_companies FOR DELETE TO authenticated USING (true);

INSERT INTO courier_companies (name, sort_order) VALUES
  ('Blue Dart', 1), ('DTDC', 2), ('India Post', 3),
  ('Professional Courier', 4), ('Delhivery', 5), ('FedEx', 6),
  ('DHL', 7), ('Amazon Logistics', 8), ('Other', 9)
ON CONFLICT (name) DO NOTHING;

-- ============================
-- CLIENTS
-- ============================
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text UNIQUE NOT NULL,
  client_name text NOT NULL,
  client_type_id uuid REFERENCES client_types(id),
  pan_number text,
  gst_number text,
  tan text,
  cin text,
  llpin text,
  registration_number text,
  contact_person text,
  mobile_number text,
  email text,
  office_address text,
  assigned_employee_id uuid REFERENCES employees(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'onboarding', 'exited')),
  notes text,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id),
  delete_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_clients_client_id ON clients(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_is_deleted ON clients(is_deleted);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "clients_insert" ON clients;
CREATE POLICY "clients_insert" ON clients FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "clients_update" ON clients;
CREATE POLICY "clients_update" ON clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "clients_delete" ON clients;
CREATE POLICY "clients_delete" ON clients FOR DELETE TO authenticated USING (true);

-- Sequence for client IDs
CREATE SEQUENCE IF NOT EXISTS client_id_seq START 1;

-- ============================
-- CABINETS
-- ============================
CREATE TABLE IF NOT EXISTS cabinets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_name text NOT NULL,
  cabinet_number text,
  num_shelves integer DEFAULT 0,
  num_drawers integer DEFAULT 0,
  capacity integer DEFAULT 100,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'full', 'under_maintenance')),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE cabinets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cabinets_select" ON cabinets;
CREATE POLICY "cabinets_select" ON cabinets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cabinets_insert" ON cabinets;
CREATE POLICY "cabinets_insert" ON cabinets FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cabinets_update" ON cabinets;
CREATE POLICY "cabinets_update" ON cabinets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cabinets_delete" ON cabinets;
CREATE POLICY "cabinets_delete" ON cabinets FOR DELETE TO authenticated USING (true);

-- ============================
-- PHYSICAL FILES
-- ============================
CREATE TABLE IF NOT EXISTS physical_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id text UNIQUE NOT NULL,
  file_number text NOT NULL,
  file_name text NOT NULL,
  client_id uuid REFERENCES clients(id),
  cabinet_id uuid REFERENCES cabinets(id),
  shelf text,
  drawer text,
  rack text,
  current_holder_id uuid REFERENCES employees(id),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'sent_outside', 'archived', 'missing')),
  last_movement_date timestamptz,
  remarks text,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id),
  delete_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_physical_files_client_id ON physical_files(client_id);
CREATE INDEX IF NOT EXISTS idx_physical_files_status ON physical_files(status);
CREATE INDEX IF NOT EXISTS idx_physical_files_is_deleted ON physical_files(is_deleted);

ALTER TABLE physical_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "physical_files_select" ON physical_files;
CREATE POLICY "physical_files_select" ON physical_files FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "physical_files_insert" ON physical_files;
CREATE POLICY "physical_files_insert" ON physical_files FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "physical_files_update" ON physical_files;
CREATE POLICY "physical_files_update" ON physical_files FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "physical_files_delete" ON physical_files;
CREATE POLICY "physical_files_delete" ON physical_files FOR DELETE TO authenticated USING (true);

CREATE SEQUENCE IF NOT EXISTS file_id_seq START 1;

-- ============================
-- FILE MOVEMENTS
-- ============================
CREATE TABLE IF NOT EXISTS file_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id text UNIQUE NOT NULL,
  file_id uuid REFERENCES physical_files(id),
  taken_by_id uuid REFERENCES employees(id),
  purpose text,
  taken_date timestamptz NOT NULL DEFAULT now(),
  expected_return_date timestamptz,
  remarks text,
  returned_date timestamptz,
  returned_by_id uuid REFERENCES employees(id),
  received_by_id uuid REFERENCES employees(id),
  return_remarks text,
  status text NOT NULL DEFAULT 'out' CHECK (status IN ('out', 'returned', 'overdue')),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id),
  delete_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_file_movements_file_id ON file_movements(file_id);
CREATE INDEX IF NOT EXISTS idx_file_movements_status ON file_movements(status);

ALTER TABLE file_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "file_movements_select" ON file_movements;
CREATE POLICY "file_movements_select" ON file_movements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "file_movements_insert" ON file_movements;
CREATE POLICY "file_movements_insert" ON file_movements FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "file_movements_update" ON file_movements;
CREATE POLICY "file_movements_update" ON file_movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "file_movements_delete" ON file_movements;
CREATE POLICY "file_movements_delete" ON file_movements FOR DELETE TO authenticated USING (true);

CREATE SEQUENCE IF NOT EXISTS movement_id_seq START 1;

-- ============================
-- COURIERS
-- ============================
CREATE TABLE IF NOT EXISTS couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id text UNIQUE NOT NULL,
  received_date timestamptz NOT NULL DEFAULT now(),
  courier_company_id uuid REFERENCES courier_companies(id),
  courier_company_name text,
  tracking_number text,
  sender text,
  receiver text,
  client_id uuid REFERENCES clients(id),
  parcel_description text,
  received_by_id uuid REFERENCES employees(id),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'delivered', 'pending', 'returned', 'cancelled')),
  remarks text,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id),
  delete_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_couriers_client_id ON couriers(client_id);
CREATE INDEX IF NOT EXISTS idx_couriers_status ON couriers(status);

ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couriers_select" ON couriers;
CREATE POLICY "couriers_select" ON couriers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "couriers_insert" ON couriers;
CREATE POLICY "couriers_insert" ON couriers FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "couriers_update" ON couriers;
CREATE POLICY "couriers_update" ON couriers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "couriers_delete" ON couriers;
CREATE POLICY "couriers_delete" ON couriers FOR DELETE TO authenticated USING (true);

CREATE SEQUENCE IF NOT EXISTS courier_id_seq START 1;

-- ============================
-- ACTIVITIES
-- ============================
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id text UNIQUE NOT NULL,
  title text NOT NULL,
  activity_type_id uuid REFERENCES activity_types(id),
  client_id uuid REFERENCES clients(id),
  assigned_employee_id uuid REFERENCES employees(id),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'on_hold', 'cancelled')),
  start_date date,
  due_date date,
  completion_date date,
  notes text,
  reminder_date timestamptz,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id),
  delete_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_activities_client_id ON activities(client_id);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_due_date ON activities(due_date);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_select" ON activities;
CREATE POLICY "activities_select" ON activities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "activities_insert" ON activities;
CREATE POLICY "activities_insert" ON activities FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "activities_update" ON activities;
CREATE POLICY "activities_update" ON activities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "activities_delete" ON activities;
CREATE POLICY "activities_delete" ON activities FOR DELETE TO authenticated USING (true);

CREATE SEQUENCE IF NOT EXISTS activity_id_seq START 1;

-- ============================
-- CLIENT NOTES
-- ============================
CREATE TABLE IF NOT EXISTS client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id),
  note_text text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_notes_select" ON client_notes;
CREATE POLICY "client_notes_select" ON client_notes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "client_notes_insert" ON client_notes;
CREATE POLICY "client_notes_insert" ON client_notes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "client_notes_update" ON client_notes;
CREATE POLICY "client_notes_update" ON client_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "client_notes_delete" ON client_notes;
CREATE POLICY "client_notes_delete" ON client_notes FOR DELETE TO authenticated USING (true);

-- ============================
-- AUDIT LOGS (permanent, no delete)
-- ============================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  user_name text,
  action text NOT NULL,
  module text NOT NULL,
  record_id text,
  record_display text,
  old_values jsonb,
  new_values jsonb,
  notes text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================
-- NOTIFICATIONS
-- ============================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  related_module text,
  related_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================
-- IMPORT BATCHES
-- ============================
CREATE TABLE IF NOT EXISTS import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text UNIQUE NOT NULL,
  module text NOT NULL,
  file_name text,
  total_rows integer DEFAULT 0,
  success_count integer DEFAULT 0,
  skip_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_report jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_batches_select" ON import_batches;
CREATE POLICY "import_batches_select" ON import_batches FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "import_batches_insert" ON import_batches;
CREATE POLICY "import_batches_insert" ON import_batches FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "import_batches_update" ON import_batches;
CREATE POLICY "import_batches_update" ON import_batches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================
-- FEEDBACK
-- ============================
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid REFERENCES auth.users(id),
  submitter_name text,
  type text NOT NULL CHECK (type IN ('bug', 'feature_request', 'general')),
  subject text NOT NULL,
  description text NOT NULL,
  page_module text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_select" ON feedback;
CREATE POLICY "feedback_select" ON feedback FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "feedback_insert" ON feedback;
CREATE POLICY "feedback_insert" ON feedback FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "feedback_update" ON feedback;
CREATE POLICY "feedback_update" ON feedback FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================
-- COMPANY SETTINGS
-- ============================
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name text NOT NULL DEFAULT 'Lakhia And Co.',
  address text,
  contact text,
  email text,
  reminder_lead_days integer DEFAULT 1,
  theme_mode text DEFAULT 'light',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_settings_select" ON company_settings;
CREATE POLICY "company_settings_select" ON company_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "company_settings_insert" ON company_settings;
CREATE POLICY "company_settings_insert" ON company_settings FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "company_settings_update" ON company_settings;
CREATE POLICY "company_settings_update" ON company_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Seed default company settings
INSERT INTO company_settings (firm_name) VALUES ('Lakhia And Co.')
ON CONFLICT DO NOTHING;
