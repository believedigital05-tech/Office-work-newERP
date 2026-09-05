import { supabase } from './supabase';

interface AuditEntry {
  action: string;
  module: string;
  record_id?: string;
  record_display?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  notes?: string;
}

export async function logAudit(entry: AuditEntry, userId?: string, userName?: string) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      user_name: userName,
      ...entry,
    });
  } catch {
    // audit log failures are silent
  }
}
