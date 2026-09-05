import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { supabase } from '../../lib/supabase';
import type { Employee, CompanySettings } from '../../types';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import { useAuth } from '../../contexts/AuthContext';

export default function SettingsPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState(0);
  const isAdmin = profile?.role === 'admin';
  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';

  return (
    <Box>
      <PageHeader title="Settings" subtitle="System configuration and management" />
      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label="Company" />
          <Tab label="Employees" />
          {isAdmin && <Tab label="User Accounts" />}
          {isAdminOrManager && <Tab label="Dropdowns" />}
          <Tab label="My Profile" />
          <Tab label="Feedback" />
        </Tabs>
        <Box sx={{ p: 2 }}>
          {tab === 0 && <CompanyTab />}
          {tab === 1 && <EmployeesTab />}
          {tab === 2 && isAdmin && <UserAccountsTab />}
          {tab === (isAdmin ? 3 : 2) && isAdminOrManager && <DropdownsTab />}
          {tab === (isAdmin ? 4 : isAdminOrManager ? 3 : 2) && <ProfileTab />}
          {tab === (isAdmin ? 5 : isAdminOrManager ? 4 : 3) && <FeedbackTab />}
        </Box>
      </Paper>
    </Box>
  );
}

function CompanyTab() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Partial<CompanySettings>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.from('company_settings').select('*').maybeSingle().then(r => setSettings(r.data ?? {}));
  }, []);

  async function save() {
    setSaving(true);
    if (settings.id) {
      await supabase.from('company_settings').update({ ...settings, updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', settings.id);
    } else {
      await supabase.from('company_settings').insert({ ...settings, updated_by: user?.id });
    }
    setSaving(false); setSuccess(true); setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} mb={2}>Company Information</Typography>
      {success && <Alert severity="success" sx={{ mb: 2 }}>Settings saved!</Alert>}
      <Grid container spacing={2} maxWidth={600}>
        <Grid size={12}><TextField label="Firm Name" value={settings.firm_name ?? ''} onChange={e => setSettings(p => ({ ...p, firm_name: e.target.value }))} fullWidth size="small" /></Grid>
        <Grid size={12}><TextField label="Address" value={settings.address ?? ''} onChange={e => setSettings(p => ({ ...p, address: e.target.value }))} fullWidth size="small" multiline rows={3} /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><TextField label="Contact" value={settings.contact ?? ''} onChange={e => setSettings(p => ({ ...p, contact: e.target.value }))} fullWidth size="small" /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><TextField label="Email" value={settings.email ?? ''} onChange={e => setSettings(p => ({ ...p, email: e.target.value }))} fullWidth size="small" /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><TextField label="Reminder Lead Days" type="number" value={settings.reminder_lead_days ?? 1} onChange={e => setSettings(p => ({ ...p, reminder_lead_days: Number(e.target.value) }))} fullWidth size="small" inputProps={{ min: 0 }} /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><TextField label="Retention Years (for disposal)" type="number" value={settings.retention_years ?? 8} onChange={e => setSettings(p => ({ ...p, retention_years: Number(e.target.value) }))} fullWidth size="small" inputProps={{ min: 1 }} /></Grid>
        <Grid size={12}><Button variant="contained" onClick={save} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>Save Settings</Button></Grid>
      </Grid>
    </Box>
  );
}

function EmployeesTab() {
  const { user, profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', role: 'staff', department: '', contact_number: '', email: '', status: 'active' });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => { loadEmployees(); }, []);

  async function loadEmployees() {
    const { data } = await supabase.from('employees').select('*').order('full_name');
    setEmployees(data ?? []);
  }

  function openEdit(emp: Employee | null) {
    setEditEmp(emp);
    setForm(emp ? { full_name: emp.full_name, role: emp.role, department: emp.department ?? '', contact_number: emp.contact_number ?? '', email: emp.email ?? '', status: emp.status } : { full_name: '', role: 'staff', department: '', contact_number: '', email: '', status: 'active' });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    if (editEmp) {
      await supabase.from('employees').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editEmp.id);
    } else {
      const code = `EMP${Date.now().toString().slice(-4)}`;
      await supabase.from('employees').insert({ ...form, employee_code: code, created_by: user?.id });
    }
    setSaving(false); setDialogOpen(false); loadEmployees();
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>Employee Master</Typography>
        {isAdmin && <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => openEdit(null)}>Add Employee</Button>}
      </Box>
      <Table size="small">
        <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Code</TableCell><TableCell>Role</TableCell><TableCell>Department</TableCell><TableCell>Contact</TableCell><TableCell>Status</TableCell>{isAdmin && <TableCell>Actions</TableCell>}</TableRow></TableHead>
        <TableBody>
          {employees.map(e => <TableRow key={e.id} hover>
            <TableCell><Typography variant="body2" fontWeight={500}>{e.full_name}</Typography></TableCell>
            <TableCell>{e.employee_code ?? '-'}</TableCell>
            <TableCell><StatusChip status={e.role} /></TableCell>
            <TableCell>{e.department ?? '-'}</TableCell>
            <TableCell>{e.contact_number ?? e.email ?? '-'}</TableCell>
            <TableCell><StatusChip status={e.status} /></TableCell>
            {isAdmin && <TableCell><IconButton size="small" onClick={() => openEdit(e)}><EditIcon fontSize="small" /></IconButton></TableCell>}
          </TableRow>)}
        </TableBody>
      </Table>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editEmp ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={12}><TextField label="Full Name *" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} fullWidth size="small" /></Grid>
            <Grid size={6}><TextField select label="Role" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} fullWidth size="small">
              {['admin','manager','staff','intern'].map(r => <MenuItem key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</MenuItem>)}
            </TextField></Grid>
            <Grid size={6}><TextField select label="Status" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} fullWidth size="small"><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem></TextField></Grid>
            <Grid size={12}><TextField label="Department" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} fullWidth size="small" /></Grid>
            <Grid size={6}><TextField label="Contact" value={form.contact_number} onChange={e => setForm(p => ({ ...p, contact_number: e.target.value }))} fullWidth size="small" /></Grid>
            <Grid size={6}><TextField label="Email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} fullWidth size="small" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={save} variant="contained" disabled={saving || !form.full_name}>{editEmp ? 'Save' : 'Add'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function UserAccountsTab() {
  const [accounts, setAccounts] = useState<Array<Record<string, unknown>>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'staff' });

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    setAccounts(data ?? []);
  }

  async function createAccount() {
    if (!form.email || !form.password || !form.full_name) { setError('All fields required.'); return; }
    setSaving(true); setError('');
    try {
      const { data, error: rpcError } = await supabase.functions.invoke('create-admin', {
        body: { email: form.email, password: form.password, full_name: form.full_name, role: form.role },
      });
      if (rpcError) throw rpcError;
      if (data && typeof data === 'object' && 'error' in data && data.error) throw new Error(data.error as string);
      setDialogOpen(false); setForm({ email: '', password: '', full_name: '', role: 'staff' }); loadAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>User Accounts</Typography>
        <Button startIcon={<PersonAddIcon />} variant="contained" size="small" onClick={() => { setForm({ email: '', password: '', full_name: '', role: 'staff' }); setError(''); setDialogOpen(true); }}>Create Account</Button>
      </Box>

      <Table size="small">
        <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Role</TableCell><TableCell>Active</TableCell><TableCell>Created</TableCell></TableRow></TableHead>
        <TableBody>
          {accounts.map(a => <TableRow key={a.id as string} hover>
            <TableCell>{a.full_name as string}</TableCell>
            <TableCell><StatusChip status={a.role as string} /></TableCell>
            <TableCell>{a.is_active ? 'Yes' : 'No'}</TableCell>
            <TableCell>{a.created_at ? new Date(a.created_at as string).toLocaleDateString() : '-'}</TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create User Account</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Grid container spacing={2}>
            <Grid size={12}><TextField label="Full Name *" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} fullWidth size="small" /></Grid>
            <Grid size={12}><TextField label="Email *" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} fullWidth size="small" /></Grid>
            <Grid size={12}><TextField label="Temporary Password *" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} fullWidth size="small" /></Grid>
            <Grid size={12}><TextField select label="Role" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} fullWidth size="small">
              {['admin','manager','staff','intern'].map(r => <MenuItem key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</MenuItem>)}
            </TextField></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={createAccount} variant="contained" disabled={saving}>{saving ? <CircularProgress size={16} color="inherit" /> : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function DropdownsTab() {
  const [activeDropdown, setActiveDropdown] = useState('client_types');
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const dropdowns = [
    { key: 'client_types', label: 'Client Types' },
    { key: 'activity_types', label: 'Activity Types' },
    { key: 'courier_companies', label: 'Courier Companies' },
    { key: 'financial_years', label: 'Financial Years' },
    { key: 'assessment_years', label: 'Assessment Years' },
  ];

  useEffect(() => { loadItems(); }, [activeDropdown]);

  async function loadItems() {
    const { data } = await supabase.from(activeDropdown).select('*').order('sort_order');
    setItems(data ?? []);
  }

  async function addItem() {
    if (!newName.trim()) return;
    setSaving(true);
    const maxOrder = Math.max(0, ...items.map(i => i.sort_order as number));
    if (activeDropdown === 'financial_years' || activeDropdown === 'assessment_years') {
      const startYear = parseInt(newName.split('-')[0]);
      await supabase.from(activeDropdown).insert({ label: newName, start_year: isNaN(startYear) ? 0 : startYear, is_active: true, sort_order: maxOrder + 1 });
    } else {
      await supabase.from(activeDropdown).insert({ name: newName, sort_order: maxOrder + 1 });
    }
    setNewName(''); setSaving(false); loadItems();
  }

  async function toggleActive(item: Record<string, unknown>) {
    await supabase.from(activeDropdown).update({ is_active: !item.is_active }).eq('id', item.id);
    loadItems();
  }

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} mb={2}>Manage Dropdown Lists</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {dropdowns.map(d => <Button key={d.key} variant={activeDropdown === d.key ? 'contained' : 'outlined'} size="small" onClick={() => setActiveDropdown(d.key)}>{d.label}</Button>)}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField size="small" placeholder={activeDropdown === 'financial_years' || activeDropdown === 'assessment_years' ? 'Add e.g. 2030-31...' : 'Add new item...'} value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} />
        <Button variant="contained" onClick={addItem} disabled={saving || !newName.trim()}>Add</Button>
      </Box>
      <Table size="small">
        <TableHead><TableRow><TableCell>#</TableCell><TableCell>{activeDropdown === 'financial_years' || activeDropdown === 'assessment_years' ? 'Label' : 'Name'}</TableCell><TableCell>Active</TableCell></TableRow></TableHead>
        <TableBody>
          {items.map(item => <TableRow key={item.id as string} hover>
            <TableCell>{item.sort_order as number}</TableCell>
            <TableCell>{(item.name ?? item.label) as string}</TableCell>
            <TableCell><FormControlLabel control={<Switch checked={item.is_active as boolean} onChange={() => toggleActive(item)} size="small" />} label="" /></TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
    </Box>
  );
}

function FeedbackTab() {
  const { user, profile } = useAuth();
  const [feedbackList, setFeedbackList] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({ type: 'general', subject: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => { loadFeedback(); }, []);

  async function loadFeedback() {
    const { data } = await supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(20);
    setFeedbackList(data ?? []);
  }

  async function submit() {
    if (!form.subject.trim() || !form.description.trim()) return;
    setSaving(true);
    await supabase.from('feedback').insert({
      ...form, submitted_by: user?.id, submitter_name: profile?.full_name, status: 'new',
    });
    setForm({ type: 'general', subject: '', description: '' });
    setSaving(false); setSuccess(true); setTimeout(() => setSuccess(false), 3000);
    loadFeedback();
  }

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} mb={2}>Submit Feedback</Typography>
      {success && <Alert severity="success" sx={{ mb: 2 }}>Thank you for your feedback!</Alert>}
      <Grid container spacing={2} maxWidth={600}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField select label="Type" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} fullWidth size="small">
            <MenuItem value="bug">Bug Report</MenuItem>
            <MenuItem value="feature_request">Feature Request</MenuItem>
            <MenuItem value="general">General</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 8 }}>
          <TextField label="Subject" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} fullWidth size="small" />
        </Grid>
        <Grid size={12}>
          <TextField label="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} fullWidth size="small" multiline rows={4} />
        </Grid>
        <Grid size={12}>
          <Button variant="contained" onClick={submit} disabled={saving || !form.subject.trim() || !form.description.trim()}>Submit Feedback</Button>
        </Grid>
      </Grid>

      {feedbackList.length > 0 && (
        <Box mt={4}>
          <Typography variant="subtitle1" fontWeight={600} mb={1}>Recent Feedback</Typography>
          <Table size="small">
            <TableHead><TableRow><TableCell>Type</TableCell><TableCell>Subject</TableCell><TableCell>Status</TableCell><TableCell>Date</TableCell></TableRow></TableHead>
            <TableBody>
              {feedbackList.map(f => <TableRow key={f.id as string} hover>
                <TableCell>{f.type as string}</TableCell>
                <TableCell>{f.subject as string}</TableCell>
                <TableCell><StatusChip status={f.status as string} /></TableCell>
                <TableCell>{new Date(f.created_at as string).toLocaleDateString()}</TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}

function ProfileTab() {
  const { profile, user, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ full_name: profile?.full_name ?? '' });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  async function saveProfile() {
    setSaving(true);
    await supabase.from('profiles').update({ full_name: form.full_name, updated_at: new Date().toISOString() }).eq('id', user?.id!);
    await refreshProfile();
    setSaving(false); setSuccess(true); setTimeout(() => setSuccess(false), 3000);
  }

  async function changePassword() {
    setPwError('');
    if (pwForm.new_password !== pwForm.confirm_password) { setPwError('Passwords do not match.'); return; }
    if (pwForm.new_password.length < 6) { setPwError('Password must be at least 6 characters.'); return; }
    const { error } = await supabase.auth.updateUser({ password: pwForm.new_password });
    if (error) { setPwError(error.message); return; }
    await supabase.from('profiles').update({ must_change_password: false }).eq('id', user?.id!);
    setPwSuccess(true); setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    setTimeout(() => setPwSuccess(false), 3000);
  }

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Typography variant="subtitle1" fontWeight={600} mb={2}>My Profile</Typography>
        {success && <Alert severity="success" sx={{ mb: 2 }}>Profile saved!</Alert>}
        <Grid container spacing={2}>
          <Grid size={12}><TextField label="Full Name" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} fullWidth size="small" /></Grid>
          <Grid size={12}><TextField label="Email" value={user?.email ?? ''} fullWidth size="small" disabled /></Grid>
          <Grid size={12}><TextField label="Role" value={profile?.role ?? ''} fullWidth size="small" disabled /></Grid>
          <Grid size={12}><Button variant="contained" onClick={saveProfile} disabled={saving}>Save Profile</Button></Grid>
        </Grid>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Typography variant="subtitle1" fontWeight={600} mb={2}>Change Password</Typography>
        {pwError && <Alert severity="error" sx={{ mb: 2 }}>{pwError}</Alert>}
        {pwSuccess && <Alert severity="success" sx={{ mb: 2 }}>Password changed!</Alert>}
        <Grid container spacing={2}>
          <Grid size={12}><TextField label="New Password" type="password" value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} fullWidth size="small" /></Grid>
          <Grid size={12}><TextField label="Confirm Password" type="password" value={pwForm.confirm_password} onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))} fullWidth size="small" /></Grid>
          <Grid size={12}><Button variant="contained" color="warning" onClick={changePassword}>Change Password</Button></Grid>
        </Grid>
      </Grid>
    </Grid>
  );
}
