import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { supabase } from '../../lib/supabase';
import type { Client, ClientType, Employee } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../lib/audit';

interface ClientDialogProps {
  open: boolean;
  client: Client | null;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_OPTIONS = ['active', 'inactive', 'onboarding', 'exited'];

export default function ClientDialog({ open, client, onClose, onSaved }: ClientDialogProps) {
  const { user, profile } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [clientTypes, setClientTypes] = useState<ClientType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    client_name: '', client_type_id: '', pan_number: '', gst_number: '',
    tan: '', cin: '', llpin: '', registration_number: '',
    contact_person: '', mobile_number: '', email: '', office_address: '',
    assigned_employee_id: '', status: 'active', notes: '',
  });

  useEffect(() => {
    if (open) {
      loadLookups();
      if (client) {
        setForm({
          client_name: client.client_name ?? '',
          client_type_id: client.client_type_id ?? '',
          pan_number: client.pan_number ?? '',
          gst_number: client.gst_number ?? '',
          tan: client.tan ?? '',
          cin: client.cin ?? '',
          llpin: client.llpin ?? '',
          registration_number: client.registration_number ?? '',
          contact_person: client.contact_person ?? '',
          mobile_number: client.mobile_number ?? '',
          email: client.email ?? '',
          office_address: client.office_address ?? '',
          assigned_employee_id: client.assigned_employee_id ?? '',
          status: client.status ?? 'active',
          notes: client.notes ?? '',
        });
      } else {
        setForm({
          client_name: '', client_type_id: '', pan_number: '', gst_number: '',
          tan: '', cin: '', llpin: '', registration_number: '',
          contact_person: '', mobile_number: '', email: '', office_address: '',
          assigned_employee_id: '', status: 'active', notes: '',
        });
      }
      setError('');
    }
  }, [open, client]);

  async function loadLookups() {
    const [typesRes, empRes] = await Promise.all([
      supabase.from('client_types').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('employees').select('*').eq('status', 'active').order('full_name'),
    ]);
    setClientTypes(typesRes.data ?? []);
    setEmployees(empRes.data ?? []);
  }

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function sanitiseForm(f: typeof form) {
    return {
      ...f,
      client_type_id: f.client_type_id || null,
      assigned_employee_id: f.assigned_employee_id || null,
    };
  }

  async function handleSave() {
    if (!form.client_name.trim()) { setError('Client name is required.'); return; }
    setSaving(true);
    setError('');
    const payload = sanitiseForm(form);
    try {
      if (client) {
        await supabase.from('clients').update({
          ...payload, updated_by: user?.id, updated_at: new Date().toISOString(),
        }).eq('id', client.id);
        await logAudit({ action: 'UPDATE', module: 'clients', record_id: client.id, record_display: form.client_name }, user?.id, profile?.full_name);
      } else {
        const { data: clientId, error: idError } = await supabase.rpc('generate_client_id');
        if (idError || !clientId) throw new Error(idError?.message ?? 'Failed to generate client ID');
        const { data: inserted, error: insertError } = await supabase.from('clients').insert({
          ...payload, client_id: clientId as string, created_by: user?.id, updated_by: user?.id,
        }).select().single();
        if (insertError) throw insertError;
        await logAudit({ action: 'CREATE', module: 'clients', record_id: (inserted as Client)?.id, record_display: form.client_name }, user?.id, profile?.full_name);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      let msg = 'Save failed';
      if (err instanceof Error) msg = err.message;
      else if (typeof err === 'object' && err !== null && 'message' in err) msg = String((err as Record<string,unknown>).message);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const f = (label: string, field: string, opts?: { multiline?: boolean; rows?: number; type?: string }) => (
    <TextField
      label={label}
      value={form[field as keyof typeof form]}
      onChange={e => set(field, e.target.value)}
      fullWidth size="small"
      multiline={opts?.multiline}
      rows={opts?.rows}
      type={opts?.type}
    />
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle>{client ? 'Edit Client' : 'Add New Client'}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="subtitle2" color="primary" mb={1}>Basic Information</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>{f('Client Name *', 'client_name')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select label="Client Type" value={form.client_type_id} onChange={e => set('client_type_id', e.target.value)} fullWidth size="small">
              <MenuItem value="">-- Select --</MenuItem>
              {clientTypes.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('Contact Person', 'contact_person')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('Mobile Number', 'mobile_number')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('Email', 'email', { type: 'email' })}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select label="Status" value={form.status} onChange={e => set('status', e.target.value)} fullWidth size="small">
              {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={12}>{f('Office Address', 'office_address', { multiline: true, rows: 2 })}</Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" color="primary" mb={1}>Tax & Registration Numbers</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>{f('PAN Number', 'pan_number')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('GST Number', 'gst_number')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('TAN', 'tan')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('CIN', 'cin')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('LLPIN', 'llpin')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('Registration Number', 'registration_number')}</Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" color="primary" mb={1}>Assignment</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select label="Assigned Employee" value={form.assigned_employee_id} onChange={e => set('assigned_employee_id', e.target.value)} fullWidth size="small">
              <MenuItem value="">-- None --</MenuItem>
              {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={12}>{f('Notes', 'notes', { multiline: true, rows: 3 })}</Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {client ? 'Save Changes' : 'Add Client'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
