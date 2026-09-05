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
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import DeleteIcon from '@mui/icons-material/Delete';
import { supabase } from '../../lib/supabase';
import type { FileMovement, PhysicalFile, Employee } from '../../types';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../lib/audit';
import { format, isPast } from 'date-fns';

const STATUS_OPTIONS = ['all', 'out', 'returned', 'overdue'];

export default function MovementsPage() {
  const { profile, user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [movements, setMovements] = useState<FileMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [returnDialog, setReturnDialog] = useState<{ open: boolean; movement: FileMovement | null }>({ open: false, movement: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; movement: FileMovement | null }>({ open: false, movement: null });
  const [files, setFiles] = useState<PhysicalFile[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filesLoading, setFilesLoading] = useState(false);
  const [form, setForm] = useState({ file_id: '', taken_by_id: '', purpose: '', taken_date: new Date().toISOString().split('T')[0], expected_return_date: '', remarks: '' });
  const [returnForm, setReturnForm] = useState({ returned_by_id: '', received_by_id: '', returned_date: new Date().toISOString().split('T')[0], return_remarks: '' });

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'staff';

  const loadMovements = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('file_movements')
      .select('*, file:physical_files(file_name,file_id,cabinet:cabinets(cabinet_name)), taken_by:employees!file_movements_taken_by_id_fkey(full_name), received_by:employees!file_movements_received_by_id_fkey(full_name)', { count: 'exact' })
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search) query = query.or(`movement_id.ilike.%${search}%,purpose.ilike.%${search}%`);
    const { data, count } = await query;
    const movs = (data as FileMovement[]) ?? [];
    const updated = movs.map(m => {
      if (m.status === 'out' && m.expected_return_date && isPast(new Date(m.expected_return_date))) {
        return { ...m, status: 'overdue' as const };
      }
      return m;
    });
    setMovements(updated);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, rowsPerPage, search, statusFilter]);

  useEffect(() => { loadMovements(); }, [loadMovements]);

  async function loadDialogData() {
    setFilesLoading(true);
    const [filesRes, empRes] = await Promise.all([
      supabase.from('physical_files').select('id,file_name,file_id,cabinet:cabinets(cabinet_name)').eq('is_deleted', false).eq('status', 'available').order('file_name'),
      supabase.from('employees').select('*').eq('status', 'active').order('full_name'),
    ]);
    setFiles((filesRes.data ?? []) as unknown as PhysicalFile[]);
    setEmployees(empRes.data ?? []);
    setFilesLoading(false);
  }

  useEffect(() => { loadDialogData(); }, []);

  async function handleSave() {
    if (!form.file_id) { setError('File is required.'); return; }
    if (!form.taken_by_id) { setError('Taken by is required.'); return; }
    setSaving(true); setError('');
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('take_file', {
        p_file_id: form.file_id,
        p_taken_by_id: form.taken_by_id,
        p_taken_date: new Date(form.taken_date).toISOString(),
        p_purpose: form.purpose || null,
        p_expected_return_date: form.expected_return_date ? new Date(form.expected_return_date).toISOString() : null,
        p_remarks: form.remarks || null,
        p_created_by: user?.id ?? null,
      });
      if (rpcError) throw rpcError;
      await logAudit({ action: 'CREATE', module: 'movements', record_id: (rpcResult as { id: string }).id, record_display: (rpcResult as { movement_id: string }).movement_id }, user?.id, profile?.full_name);
      setDialogOpen(false);
      await loadMovements();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record movement. Both writes must succeed — please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReturn() {
    if (!returnDialog.movement) return;
    if (!returnForm.returned_by_id) { return; }
    setSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc('return_file', {
        p_movement_id: returnDialog.movement.id,
        p_returned_by_id: returnForm.returned_by_id,
        p_returned_date: new Date(returnForm.returned_date).toISOString(),
        p_received_by_id: returnForm.received_by_id || null,
        p_return_remarks: returnForm.return_remarks || null,
        p_updated_by: user?.id ?? null,
      });
      if (rpcError) throw rpcError;
      await logAudit({ action: 'RETURN', module: 'movements', record_id: returnDialog.movement!.id, record_display: returnDialog.movement!.movement_id }, user?.id, profile?.full_name);
      setMovements(prev => prev.map(m =>
        m.id === returnDialog.movement!.id
          ? { ...m, status: 'returned', returned_date: new Date(returnForm.returned_date).toISOString(), returned_by_id: returnForm.returned_by_id, return_remarks: returnForm.return_remarks }
          : m
      ));
      setReturnDialog({ open: false, movement: null });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to return file. Both writes must succeed — please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(reason?: string) {
    if (!deleteDialog.movement) return;
    await supabase.from('file_movements').update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: user?.id, delete_reason: reason }).eq('id', deleteDialog.movement.id);
    await logAudit({ action: 'DELETE', module: 'movements', record_id: deleteDialog.movement.id, record_display: deleteDialog.movement.movement_id, notes: reason }, user?.id, profile?.full_name);
    setDeleteDialog({ open: false, movement: null });
    loadMovements();
  }

  return (
    <Box sx={{ pb: { xs: 10, md: 0 } }}>
      <PageHeader
        title="File Movement Register"
        subtitle={`${total} records`}
        action={!isMobile && canEdit ? <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setForm({ file_id: '', taken_by_id: '', purpose: '', taken_date: new Date().toISOString().split('T')[0], expected_return_date: '', remarks: '' }); setError(''); loadDialogData(); setDialogOpen(true); }}>Record Movement</Button> : undefined}
      />

      <Paper sx={{ mb: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField placeholder="Search movement ID, purpose..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} size="small" fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
          <TextField select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} size="small" label="Status" sx={{ minWidth: 130 }}>
            {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
          </TextField>
        </Stack>
      </Paper>

      {isMobile ? (
        <Box>
          {loading ? <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
            : movements.length === 0 ? <Paper sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No movements found</Typography></Paper>
            : movements.map(m => (
              <Card key={m.id} sx={{ mb: 1.5, borderLeft: m.status === 'overdue' ? 3 : 0, borderLeftColor: 'error.main' }}>
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant="caption" color="primary.main" fontWeight={700}>{m.movement_id}</Typography>
                    <StatusChip status={m.status} />
                  </Box>
                  <Typography variant="subtitle2" fontWeight={600}>{(m.file as { file_name: string } | undefined)?.file_name ?? '-'}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">Taken by: {(m.taken_by as { full_name: string } | undefined)?.full_name ?? '-'}</Typography>
                  <Typography variant="caption" color="text.secondary">Taken: {format(new Date(m.taken_date), 'dd MMM yy')}</Typography>
                  {m.expected_return_date && <Chip label={`Due: ${format(new Date(m.expected_return_date), 'dd MMM')}`} size="small" color={m.status === 'overdue' ? 'error' : 'default'} sx={{ ml: 1 }} />}
                </CardContent>
                {canEdit && m.status !== 'returned' && (
                  <CardActions sx={{ pt: 0, px: 2, pb: 1 }}>
                    <Button size="small" color="success" startIcon={<AssignmentReturnIcon fontSize="small" />} onClick={() => { setReturnForm({ returned_by_id: '', received_by_id: '', returned_date: new Date().toISOString().split('T')[0], return_remarks: '' }); setReturnDialog({ open: true, movement: m }); }}>Return</Button>
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
              <TableCell>Movement ID</TableCell>
              <TableCell>File</TableCell>
              <TableCell>Cabinet</TableCell>
              <TableCell>Taken By</TableCell>
              <TableCell>Purpose</TableCell>
              <TableCell>Taken Date</TableCell>
              <TableCell>Expected Return</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              : movements.length === 0 ? <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No movements found</Typography></TableCell></TableRow>
              : movements.map(m => (
                <TableRow key={m.id} hover>
                  <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{m.movement_id}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{(m.file as { file_name: string } | undefined)?.file_name ?? '-'}</Typography></TableCell>
                  <TableCell><Typography variant="caption">{((m.file as { cabinet: { cabinet_name: string } } | undefined)?.cabinet as { cabinet_name: string } | undefined)?.cabinet_name ?? '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{(m.taken_by as { full_name: string } | undefined)?.full_name ?? '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{m.purpose ?? '-'}</Typography></TableCell>
                  <TableCell>{format(new Date(m.taken_date), 'dd MMM yy')}</TableCell>
                  <TableCell>
                    {m.expected_return_date ? (
                      <Chip label={format(new Date(m.expected_return_date), 'dd MMM yy')} size="small" color={m.status === 'overdue' ? 'error' : 'default'} />
                    ) : '-'}
                  </TableCell>
                  <TableCell><StatusChip status={m.status} /></TableCell>
                  <TableCell align="right">
                    {m.status !== 'returned' && canEdit && (
                      <Tooltip title="Mark Returned">
                        <IconButton size="small" color="success" onClick={() => { setReturnForm({ returned_by_id: '', received_by_id: '', returned_date: new Date().toISOString().split('T')[0], return_remarks: '' }); setReturnDialog({ open: true, movement: m }); }}>
                          <AssignmentReturnIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {(profile?.role === 'admin') && (
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, movement: m })}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        </Box>
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} />
      </Paper>
      )}

      {isMobile && canEdit && <Fab color="primary" onClick={() => { setForm({ file_id: '', taken_by_id: '', purpose: '', taken_date: new Date().toISOString().split('T')[0], expected_return_date: '', remarks: '' }); setError(''); loadDialogData(); setDialogOpen(true); }} sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1200 }}><AddIcon /></Fab>}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Record File Movement</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2}>
            <Grid size={12}>
              {filesLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">Loading available files...</Typography>
                </Box>
              ) : files.length === 0 ? (
                <Alert severity="warning">
                  No files are currently available to take out. All files are either in use or none have been added yet.
                </Alert>
              ) : (
                <Autocomplete
                  options={files}
                  getOptionLabel={f => `${f.file_id} - ${f.file_name}`}
                  value={files.find(f => f.id === form.file_id) ?? null}
                  onChange={(_, v) => setForm(p => ({ ...p, file_id: v?.id ?? '' }))}
                  renderInput={params => <TextField {...params} label="File *" size="small" />}
                  renderOption={(props, f) => (
                    <Box component="li" {...props}>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{f.file_id} - {f.file_name}</Typography>
                        {(f.cabinet as { cabinet_name: string } | undefined)?.cabinet_name && (
                          <Typography variant="caption" color="text.secondary">Cabinet: {(f.cabinet as { cabinet_name: string }).cabinet_name}</Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                />
              )}
            </Grid>
            <Grid size={12}>
              <Autocomplete
                options={employees}
                getOptionLabel={e => e.full_name ?? ''}
                value={employees.find(e => e.id === form.taken_by_id) ?? null}
                onChange={(_, v) => setForm(p => ({ ...p, taken_by_id: v?.id ?? '' }))}
                renderInput={params => <TextField {...params} label="Taken By *" size="small" />}
              />
            </Grid>
            <Grid size={12}><TextField label="Purpose" value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} fullWidth size="small" /></Grid>
            <Grid size={6}><TextField label="Taken Date *" type="date" value={form.taken_date} onChange={e => setForm(p => ({ ...p, taken_date: e.target.value }))} fullWidth size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid size={6}><TextField label="Expected Return" type="date" value={form.expected_return_date} onChange={e => setForm(p => ({ ...p, expected_return_date: e.target.value }))} fullWidth size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid size={12}><TextField label="Remarks" value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} fullWidth size="small" multiline rows={2} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={returnDialog.open} onClose={() => setReturnDialog({ open: false, movement: null })} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Mark File Returned</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={12}>
              <Autocomplete
                options={employees}
                getOptionLabel={e => e.full_name ?? ''}
                value={employees.find(e => e.id === returnForm.returned_by_id) ?? null}
                onChange={(_, v) => setReturnForm(p => ({ ...p, returned_by_id: v?.id ?? '' }))}
                renderInput={params => <TextField {...params} label="Returned By *" size="small" />}
              />
            </Grid>
            <Grid size={12}>
              <Autocomplete
                options={employees}
                getOptionLabel={e => e.full_name ?? ''}
                value={employees.find(e => e.id === returnForm.received_by_id) ?? null}
                onChange={(_, v) => setReturnForm(p => ({ ...p, received_by_id: v?.id ?? '' }))}
                renderInput={params => <TextField {...params} label="Received By" size="small" />}
              />
            </Grid>
            <Grid size={12}><TextField label="Return Date *" type="date" value={returnForm.returned_date} onChange={e => setReturnForm(p => ({ ...p, returned_date: e.target.value }))} fullWidth size="small" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid size={12}><TextField label="Remarks" value={returnForm.return_remarks} onChange={e => setReturnForm(p => ({ ...p, return_remarks: e.target.value }))} fullWidth size="small" multiline rows={2} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReturnDialog({ open: false, movement: null })}>Cancel</Button>
          <Button onClick={handleReturn} variant="contained" color="success" disabled={saving || !returnForm.returned_by_id}>Mark Returned</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={deleteDialog.open} title="Delete Movement" message={`Delete movement "${deleteDialog.movement?.movement_id}"?`} requireReason onConfirm={handleDelete} onCancel={() => setDeleteDialog({ open: false, movement: null })} />
    </Box>
  );
}
