import { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import Fab from '@mui/material/Fab';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Stack from '@mui/material/Stack';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { supabase } from '../../lib/supabase';
import type { Activity, Client, Employee, ActivityType } from '../../types';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../lib/audit';
import { format, isPast } from 'date-fns';

const STATUS_OPTS = ['all', 'not_started', 'in_progress', 'completed', 'on_hold', 'cancelled'];
const PRIORITY_OPTS = ['low', 'medium', 'high', 'urgent'];

export default function ActivitiesPage() {
  const { profile, user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; activity: Activity | null }>({ open: false, activity: null });
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const defaultForm = { title: '', activity_type_id: '', client_id: '', assigned_employee_id: '', priority: 'medium', status: 'not_started', start_date: '', due_date: '', completion_date: '', notes: '', reminder_date: '' };
  const [form, setForm] = useState(defaultForm);

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'staff';

  const loadActivities = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('activities')
      .select('*, activity_type:activity_types(name), client:clients(client_name,client_id), assigned_employee:employees(full_name)', { count: 'exact' })
      .eq('is_deleted', false)
      .order('due_date', { ascending: true, nullsFirst: false })
      .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search) query = query.or(`title.ilike.%${search}%,activity_id.ilike.%${search}%`);
    const { data, count } = await query;
    setActivities((data as Activity[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, rowsPerPage, search, statusFilter]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  useEffect(() => {
    supabase.from('clients').select('id,client_name,client_id').eq('is_deleted', false).order('client_name').then(r => setClients((r.data ?? []) as Client[]));
    supabase.from('employees').select('*').eq('status', 'active').order('full_name').then(r => setEmployees(r.data ?? []));
    supabase.from('activity_types').select('*').eq('is_active', true).order('sort_order').then(r => setActivityTypes(r.data ?? []));
  }, []);

  function openEdit(activity: Activity | null) {
    setEditActivity(activity);
    if (activity) {
      setForm({ title: activity.title, activity_type_id: activity.activity_type_id ?? '', client_id: activity.client_id ?? '', assigned_employee_id: activity.assigned_employee_id ?? '', priority: activity.priority, status: activity.status, start_date: activity.start_date ?? '', due_date: activity.due_date ?? '', completion_date: activity.completion_date ?? '', notes: activity.notes ?? '', reminder_date: activity.reminder_date ? activity.reminder_date.split('T')[0] : '' });
    } else {
      setForm(defaultForm);
    }
    setError(''); setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, activity_type_id: form.activity_type_id || null, client_id: form.client_id || null, assigned_employee_id: form.assigned_employee_id || null, start_date: form.start_date || null, due_date: form.due_date || null, completion_date: form.completion_date || null, reminder_date: form.reminder_date ? new Date(form.reminder_date).toISOString() : null };
      if (editActivity) {
        await supabase.from('activities').update({ ...payload, updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', editActivity.id);
        await logAudit({ action: 'UPDATE', module: 'activities', record_id: editActivity.id, record_display: form.title }, user?.id, profile?.full_name);
      } else {
        const actId = `AC${Date.now().toString().slice(-6)}`;
        const { data } = await supabase.from('activities').insert({ ...payload, activity_id: actId, created_by: user?.id, updated_by: user?.id }).select().single();
        await logAudit({ action: 'CREATE', module: 'activities', record_id: (data as Activity)?.id, record_display: form.title }, user?.id, profile?.full_name);
      }
      setDialogOpen(false); loadActivities();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function markComplete(activity: Activity) {
    await supabase.from('activities').update({ status: 'completed', completion_date: new Date().toISOString().split('T')[0], updated_by: user?.id }).eq('id', activity.id);
    await logAudit({ action: 'COMPLETE', module: 'activities', record_id: activity.id, record_display: activity.title }, user?.id, profile?.full_name);
    loadActivities();
  }

  async function handleDelete(reason?: string) {
    if (!deleteDialog.activity) return;
    await supabase.from('activities').update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: user?.id, delete_reason: reason }).eq('id', deleteDialog.activity.id);
    await logAudit({ action: 'DELETE', module: 'activities', record_id: deleteDialog.activity.id, record_display: deleteDialog.activity.title, notes: reason }, user?.id, profile?.full_name);
    setDeleteDialog({ open: false, activity: null }); loadActivities();
  }

  return (
    <Box sx={{ pb: { xs: 10, md: 0 } }}>
      <PageHeader
        title="Activity Register"
        subtitle={`${total} activities`}
        action={!isMobile && canEdit ? <Button startIcon={<AddIcon />} variant="contained" onClick={() => openEdit(null)}>Add Activity</Button> : undefined}
      />

      <Paper sx={{ mb: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField placeholder="Search title, ID..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} size="small" fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
          <TextField select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} size="small" label="Status" sx={{ minWidth: 130 }}>
            {STATUS_OPTS.map(s => <MenuItem key={s} value={s}>{s === 'all' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</MenuItem>)}
          </TextField>
        </Stack>
      </Paper>

      {isMobile ? (
        <Box>
          {loading ? <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
            : activities.length === 0 ? <Paper sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No activities found</Typography></Paper>
            : activities.map(a => {
              const isOverdue = a.due_date && isPast(new Date(a.due_date)) && a.status !== 'completed' && a.status !== 'cancelled';
              return (
                <Card key={a.id} sx={{ mb: 1.5, borderLeft: isOverdue ? 3 : 0, borderLeftColor: 'error.main' }}>
                  <CardContent sx={{ pb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                      <Typography variant="caption" color="primary.main" fontWeight={700}>{a.activity_id}</Typography>
                      <StatusChip status={a.priority} />
                    </Box>
                    <Typography variant="subtitle2" fontWeight={600}>{a.title}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {(a.client as { client_name: string } | undefined)?.client_name ?? 'No client'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                      <StatusChip status={a.status} />
                      {a.due_date && <Chip label={format(new Date(a.due_date), 'dd MMM')} size="small" color={isOverdue ? 'error' : 'default'} />}
                    </Box>
                  </CardContent>
                  {canEdit && (
                    <CardActions sx={{ pt: 0, px: 2, pb: 1 }}>
                      {a.status !== 'completed' && a.status !== 'cancelled' && <IconButton size="small" color="success" onClick={() => markComplete(a)}><CheckCircleIcon fontSize="small" /></IconButton>}
                      <IconButton size="small" onClick={() => openEdit(a)}><EditIcon fontSize="small" /></IconButton>
                      {profile?.role === 'admin' && <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, activity: a })}><DeleteIcon fontSize="small" /></IconButton>}
                    </CardActions>
                  )}
                </Card>
              );
            })}
          {total > rowsPerPage && (
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, py: 2 }}>
              <Button disabled={page === 0} onClick={() => setPage(p => p - 1)} size="small">Prev</Button>
              <Typography variant="body2" sx={{ my: 'auto' }}>{page + 1} / {Math.ceil(total / rowsPerPage)}</Typography>
              <Button disabled={(page + 1) * rowsPerPage >= total} onClick={() => setPage(p => p + 1)} size="small">Next</Button>
            </Box>
          )}
        </Box>
      ) : (
        <Paper>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Assigned To</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Status</TableCell>
                  {canEdit && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
                  : activities.length === 0 ? <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No activities found</Typography></TableCell></TableRow>
                  : activities.map(a => {
                    const isOverdue = a.due_date && isPast(new Date(a.due_date)) && a.status !== 'completed' && a.status !== 'cancelled';
                    return (
                      <TableRow key={a.id} hover sx={{ bgcolor: isOverdue ? 'error.50' : undefined }}>
                        <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{a.activity_id}</Typography></TableCell>
                        <TableCell><Typography variant="body2" fontWeight={500}>{a.title}</Typography>{a.notes && <Typography variant="caption" color="text.secondary" noWrap>{a.notes.substring(0, 40)}</Typography>}</TableCell>
                        <TableCell><Typography variant="body2">{(a.client as { client_name: string } | undefined)?.client_name ?? '-'}</Typography></TableCell>
                        <TableCell>{(a.activity_type as { name: string } | undefined)?.name ?? '-'}</TableCell>
                        <TableCell>{(a.assigned_employee as { full_name: string } | undefined)?.full_name ?? '-'}</TableCell>
                        <TableCell>{a.due_date ? <Chip label={format(new Date(a.due_date), 'dd MMM yy')} size="small" color={isOverdue ? 'error' : 'default'} /> : '-'}</TableCell>
                        <TableCell><StatusChip status={a.priority} /></TableCell>
                        <TableCell><StatusChip status={a.status} /></TableCell>
                        {canEdit && (
                          <TableCell align="right">
                            {a.status !== 'completed' && a.status !== 'cancelled' && <Tooltip title="Mark Complete"><IconButton size="small" color="success" onClick={() => markComplete(a)}><CheckCircleIcon fontSize="small" /></IconButton></Tooltip>}
                            <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(a)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                            {profile?.role === 'admin' && <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, activity: a })}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Box>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} />
        </Paper>
      )}

      {isMobile && canEdit && <Fab color="primary" onClick={() => openEdit(null)} sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1200 }}><AddIcon /></Fab>}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editActivity ? 'Edit Activity' : 'Add Activity'}</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2}>
            <Grid size={12}><TextField label="Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} fullWidth size="small" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField select label="Activity Type" value={form.activity_type_id} onChange={e => setForm(p => ({ ...p, activity_type_id: e.target.value }))} fullWidth size="small"><MenuItem value="">-- None --</MenuItem>{activityTypes.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Autocomplete options={clients} getOptionLabel={c => `${c.client_id} - ${c.client_name}`} value={clients.find(c => c.id === form.client_id) ?? null} onChange={(_, v) => setForm(p => ({ ...p, client_id: v?.id ?? '' }))} renderInput={params => <TextField {...params} label="Client" size="small" />} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField select label="Assigned To" value={form.assigned_employee_id} onChange={e => setForm(p => ({ ...p, assigned_employee_id: e.target.value }))} fullWidth size="small"><MenuItem value="">-- None --</MenuItem>{employees.map(e => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, sm: 3 }}><TextField select label="Priority" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} fullWidth size="small">{PRIORITY_OPTS.map(p => <MenuItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, sm: 3 }}><TextField select label="Status" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} fullWidth size="small">{STATUS_OPTS.filter(s => s !== 'all').map(s => <MenuItem key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField label="Start Date" type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} fullWidth size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField label="Due Date" type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} fullWidth size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField label="Reminder Date" type="date" value={form.reminder_date} onChange={e => setForm(p => ({ ...p, reminder_date: e.target.value }))} fullWidth size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid size={12}><TextField label="Notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} fullWidth size="small" multiline rows={3} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>{editActivity ? 'Save' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={deleteDialog.open} title="Delete Activity" message={`Delete activity "${deleteDialog.activity?.title}"?`} requireReason onConfirm={handleDelete} onCancel={() => setDeleteDialog({ open: false, activity: null })} />
    </Box>
  );
}
