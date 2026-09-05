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
import Fab from '@mui/material/Fab';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { supabase } from '../../lib/supabase';
import type { Courier, Client, Employee, CourierCompany } from '../../types';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../lib/audit';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const STATUS_OPTIONS = ['all', 'received', 'delivered', 'pending', 'returned', 'cancelled'];

export default function CouriersPage() {
  const { profile, user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCourier, setEditCourier] = useState<Courier | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; courier: Courier | null }>({ open: false, courier: null });
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<CourierCompany[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const defaultForm = { received_date: new Date().toISOString().split('T')[0], direction: 'inbound' as 'inbound' | 'outbound', courier_company_id: '', courier_company_name: '', tracking_number: '', sender: '', receiver: '', client_id: '', parcel_description: '', received_by_id: '', status: 'received', remarks: '' };
  const [form, setForm] = useState(defaultForm);

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'staff';

  const loadCouriers = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('couriers')
      .select('*, courier_company:courier_companies(name), client:clients(client_name,client_id), received_by:employees(full_name)', { count: 'exact' })
      .eq('is_deleted', false)
      .order('received_date', { ascending: false })
      .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search) query = query.or(`courier_id.ilike.%${search}%,tracking_number.ilike.%${search}%,sender.ilike.%${search}%,receiver.ilike.%${search}%`);
    const { data, count } = await query;
    setCouriers((data as Courier[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, rowsPerPage, search, statusFilter]);

  useEffect(() => { loadCouriers(); }, [loadCouriers]);

  useEffect(() => {
    supabase.from('clients').select('id,client_name,client_id').eq('is_deleted', false).order('client_name').then(r => setClients((r.data ?? []) as Client[]));
    supabase.from('employees').select('*').eq('status', 'active').order('full_name').then(r => setEmployees(r.data ?? []));
    supabase.from('courier_companies').select('*').eq('is_active', true).order('sort_order').then(r => setCompanies(r.data ?? []));
  }, []);

  function openEdit(courier: Courier | null) {
    setEditCourier(courier);
    if (courier) {
      setForm({ received_date: courier.received_date.split('T')[0], direction: courier.direction ?? 'inbound', courier_company_id: courier.courier_company_id ?? '', courier_company_name: courier.courier_company_name ?? '', tracking_number: courier.tracking_number ?? '', sender: courier.sender ?? '', receiver: courier.receiver ?? '', client_id: courier.client_id ?? '', parcel_description: courier.parcel_description ?? '', received_by_id: courier.received_by_id ?? '', status: courier.status, remarks: courier.remarks ?? '' });
    } else {
      setForm(defaultForm);
    }
    setError(''); setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      const payload = { ...form, received_date: new Date(form.received_date).toISOString(), courier_company_id: form.courier_company_id || null, client_id: form.client_id || null, received_by_id: form.received_by_id || null };
      if (editCourier) {
        await supabase.from('couriers').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editCourier.id);
        await logAudit({ action: 'UPDATE', module: 'couriers', record_id: editCourier.id, record_display: editCourier.courier_id }, user?.id, profile?.full_name);
      } else {
        const courierId = `CR${Date.now().toString().slice(-6)}`;
        const { data } = await supabase.from('couriers').insert({ ...payload, courier_id: courierId, created_by: user?.id }).select().single();
        await logAudit({ action: 'CREATE', module: 'couriers', record_id: (data as Courier)?.id, record_display: courierId }, user?.id, profile?.full_name);
      }
      setDialogOpen(false); loadCouriers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(reason?: string) {
    if (!deleteDialog.courier) return;
    await supabase.from('couriers').update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: user?.id, delete_reason: reason }).eq('id', deleteDialog.courier.id);
    await logAudit({ action: 'DELETE', module: 'couriers', record_id: deleteDialog.courier.id, record_display: deleteDialog.courier.courier_id, notes: reason }, user?.id, profile?.full_name);
    setDeleteDialog({ open: false, courier: null }); loadCouriers();
  }

  function handleExport() {
    const rows = couriers.map(c => ({
      'Courier ID': c.courier_id,
      'Direction': c.direction === 'outbound' ? 'Outbound' : 'Inbound',
      'Date': format(new Date(c.received_date), 'dd/MM/yyyy'),
      'Company': (c.courier_company as { name: string } | undefined)?.name ?? c.courier_company_name ?? '',
      'Tracking': c.tracking_number ?? '',
      'Sender': c.sender ?? '',
      'Receiver': c.receiver ?? '',
      'Client': (c.client as { client_name: string } | undefined)?.client_name ?? '',
      'Description': c.parcel_description ?? '',
      'Status': c.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Couriers');
    XLSX.writeFile(wb, `couriers_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  return (
    <Box sx={{ pb: { xs: 10, md: 0 } }}>
      <PageHeader
        title="Courier Register"
        subtitle={`${total} couriers`}
        action={
          !isMobile ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" size="small" onClick={handleExport}>Export</Button>
              {canEdit && <Button startIcon={<AddIcon />} variant="contained" onClick={() => openEdit(null)}>Add Courier</Button>}
            </Box>
          ) : (
            <Button variant="outlined" size="small" onClick={handleExport}>Export</Button>
          )
        }
      />

      <Paper sx={{ mb: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField placeholder="Search ID, tracking, sender..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} size="small" fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
          <TextField select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} size="small" label="Status" sx={{ minWidth: 130 }}>
            {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
          </TextField>
        </Stack>
      </Paper>

      {isMobile ? (
        <Box>
          {loading ? <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
            : couriers.length === 0 ? <Paper sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No couriers found</Typography></Paper>
            : couriers.map(c => (
              <Card key={c.id} sx={{ mb: 1.5 }}>
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant="caption" color="primary.main" fontWeight={700}>{c.courier_id}</Typography>
                    <StatusChip status={c.status} />
                  </Box>
                  <Typography variant="subtitle2" fontWeight={600}>{(c.courier_company as { name: string } | undefined)?.name ?? c.courier_company_name ?? '-'}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">{format(new Date(c.received_date), 'dd MMM yyyy')}</Typography>
                  {c.tracking_number && <Typography variant="caption" display="block">Tracking: {c.tracking_number}</Typography>}
                  {c.sender && <Typography variant="caption" display="block">From: {c.sender}</Typography>}
                  {(c.client as { client_name: string } | undefined)?.client_name && <Typography variant="caption" display="block">Client: {(c.client as { client_name: string }).client_name}</Typography>}
                </CardContent>
                {canEdit && (
                  <CardActions sx={{ pt: 0, px: 2, pb: 1 }}>
                    <IconButton size="small" onClick={() => openEdit(c)}><EditIcon fontSize="small" /></IconButton>
                    {profile?.role === 'admin' && <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, courier: c })}><DeleteIcon fontSize="small" /></IconButton>}
                  </CardActions>
                )}
              </Card>
            ))}
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
        <Table size="small" sx={{ minWidth: 800 }}>
          <TableHead>
            <TableRow>
              <TableCell>Courier ID</TableCell>
              <TableCell>Direction</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Company</TableCell>
              <TableCell>Tracking</TableCell>
              <TableCell>Sender / Receiver</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Status</TableCell>
              {canEdit && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              : couriers.length === 0 ? <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No couriers found</Typography></TableCell></TableRow>
              : couriers.map(c => (
                <TableRow key={c.id} hover>
                  <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{c.courier_id}</Typography></TableCell>
                  <TableCell><Chip label={c.direction === 'outbound' ? 'Outbound' : 'Inbound'} size="small" color={c.direction === 'outbound' ? 'warning' : 'success'} variant="outlined" /></TableCell>
                  <TableCell>{format(new Date(c.received_date), 'dd MMM yy')}</TableCell>
                  <TableCell>{(c.courier_company as { name: string } | undefined)?.name ?? c.courier_company_name ?? '-'}</TableCell>
                  <TableCell>{c.tracking_number ?? '-'}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{c.sender ?? '-'}</Typography>
                    {c.receiver && <Typography variant="caption" color="text.secondary">to: {c.receiver}</Typography>}
                  </TableCell>
                  <TableCell>{(c.client as { client_name: string } | undefined)?.client_name ?? '-'}</TableCell>
                  <TableCell><StatusChip status={c.status} /></TableCell>
                  {canEdit && (
                    <TableCell align="right">
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(c)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                      {profile?.role === 'admin' && <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, courier: c })}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
        </Box>
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} />
      </Paper>
      )}

      {isMobile && canEdit && <Fab color="primary" onClick={() => openEdit(null)} sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1200 }}><AddIcon /></Fab>}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editCourier ? 'Edit Courier' : 'Add Courier'}</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Date *" type="date" value={form.received_date} onChange={e => setForm(p => ({ ...p, received_date: e.target.value }))} fullWidth size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Direction *" value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value as 'inbound' | 'outbound' }))} fullWidth size="small">
                <MenuItem value="inbound">Inbound (Received)</MenuItem>
                <MenuItem value="outbound">Outbound (Sent)</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Courier Company" value={form.courier_company_id} onChange={e => setForm(p => ({ ...p, courier_company_id: e.target.value, courier_company_name: companies.find(c => c.id === e.target.value)?.name ?? '' }))} fullWidth size="small">
                <MenuItem value="">-- Select --</MenuItem>
                {companies.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Tracking Number" value={form.tracking_number} onChange={e => setForm(p => ({ ...p, tracking_number: e.target.value }))} fullWidth size="small" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Sender" value={form.sender} onChange={e => setForm(p => ({ ...p, sender: e.target.value }))} fullWidth size="small" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Receiver" value={form.receiver} onChange={e => setForm(p => ({ ...p, receiver: e.target.value }))} fullWidth size="small" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Autocomplete options={clients} getOptionLabel={c => `${c.client_id} - ${c.client_name}`} value={clients.find(c => c.id === form.client_id) ?? null} onChange={(_, v) => setForm(p => ({ ...p, client_id: v?.id ?? '' }))} renderInput={params => <TextField {...params} label="Client" size="small" />} />
            </Grid>
            <Grid size={12}><TextField label="Parcel Description" value={form.parcel_description} onChange={e => setForm(p => ({ ...p, parcel_description: e.target.value }))} fullWidth size="small" multiline rows={2} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField select label="Received By" value={form.received_by_id} onChange={e => setForm(p => ({ ...p, received_by_id: e.target.value }))} fullWidth size="small">
              <MenuItem value="">-- Select --</MenuItem>
              {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
            </TextField></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField select label="Status" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} fullWidth size="small">
              {STATUS_OPTIONS.filter(s => s !== 'all').map(s => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
            </TextField></Grid>
            <Grid size={12}><TextField label="Remarks" value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} fullWidth size="small" multiline rows={2} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>{editCourier ? 'Save' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={deleteDialog.open} title="Delete Courier" message={`Delete courier "${deleteDialog.courier?.courier_id}"?`} requireReason onConfirm={handleDelete} onCancel={() => setDeleteDialog({ open: false, courier: null })} />
    </Box>
  );
}
