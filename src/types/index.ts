export type Role = 'admin' | 'manager' | 'staff' | 'intern';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  employee_id?: string;
  must_change_password: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  employee_code?: string;
  full_name: string;
  role: Role;
  department?: string;
  contact_number?: string;
  email?: string;
  login_account_id?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface ClientType {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface ActivityType {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface CourierCompany {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface Client {
  id: string;
  client_id: string;
  client_name: string;
  client_type_id?: string;
  client_type?: ClientType;
  pan_number?: string;
  gst_number?: string;
  tan?: string;
  cin?: string;
  llpin?: string;
  registration_number?: string;
  contact_person?: string;
  mobile_number?: string;
  email?: string;
  office_address?: string;
  assigned_employee_id?: string;
  assigned_employee?: Employee;
  status: 'active' | 'inactive' | 'onboarding' | 'exited';
  notes?: string;
  is_deleted: boolean;
  deleted_at?: string;
  delete_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Cabinet {
  id: string;
  cabinet_name: string;
  cabinet_number?: string;
  num_shelves: number;
  num_drawers: number;
  capacity: number;
  status: 'active' | 'full' | 'under_maintenance';
  is_deleted: boolean;
  created_at: string;
}

export interface PhysicalFile {
  id: string;
  file_id: string;
  file_number: string;
  file_name: string;
  client_id?: string;
  client?: Client;
  cabinet_id?: string;
  cabinet?: Cabinet;
  shelf?: string;
  drawer?: string;
  rack?: string;
  current_holder_id?: string;
  current_holder?: Employee;
  file_subject?: string;
  assessment_year?: string;
  financial_year?: string;
  status: 'available' | 'in_use' | 'sent_outside' | 'archived' | 'missing' | 'disposed';
  last_movement_date?: string;
  remarks?: string;
  disposed_at?: string;
  disposed_by?: string;
  dispose_reason?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface FileMovement {
  id: string;
  movement_id: string;
  file_id: string;
  file?: PhysicalFile;
  taken_by_id?: string;
  taken_by?: Employee;
  purpose?: string;
  taken_date: string;
  expected_return_date?: string;
  remarks?: string;
  returned_date?: string;
  returned_by_id?: string;
  received_by_id?: string;
  received_by?: Employee;
  return_remarks?: string;
  status: 'out' | 'returned' | 'overdue';
  is_deleted: boolean;
  created_at: string;
}

export interface Courier {
  id: string;
  courier_id: string;
  received_date: string;
  courier_company_id?: string;
  courier_company?: CourierCompany;
  courier_company_name?: string;
  tracking_number?: string;
  sender?: string;
  receiver?: string;
  client_id?: string;
  client?: Client;
  parcel_description?: string;
  received_by_id?: string;
  received_by?: Employee;
  status: 'received' | 'delivered' | 'pending' | 'returned' | 'cancelled';
  direction: 'inbound' | 'outbound';
  remarks?: string;
  is_deleted: boolean;
  created_at: string;
}

export interface Activity {
  id: string;
  activity_id: string;
  title: string;
  activity_type_id?: string;
  activity_type?: ActivityType;
  client_id?: string;
  client?: Client;
  assigned_employee_id?: string;
  assigned_employee?: Employee;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  start_date?: string;
  due_date?: string;
  completion_date?: string;
  notes?: string;
  reminder_date?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_name?: string;
  action: string;
  module: string;
  record_id?: string;
  record_display?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  notes?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message?: string;
  type: string;
  is_read: boolean;
  related_module?: string;
  related_id?: string;
  created_at: string;
}

export interface CompanySettings {
  id: string;
  firm_name: string;
  address?: string;
  contact?: string;
  email?: string;
  reminder_lead_days: number;
  theme_mode: string;
  retention_years: number;
  updated_at: string;
}

export interface FinancialYear {
  id: string;
  label: string;
  start_year: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface AssessmentYear {
  id: string;
  label: string;
  start_year: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}
