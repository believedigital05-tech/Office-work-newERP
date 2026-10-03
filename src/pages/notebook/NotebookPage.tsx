import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TablePagination from '@mui/material/TablePagination';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Autocomplete from '@mui/material/Autocomplete';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import type { Client, NotebookEntry, NotebookEntryHistory, NotebookStatus, PhysicalFile, Profile } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../lib/audit';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import PdfExportDialog, { type PdfColumn, type PdfRow } from '../../components/common/PdfExportDialog';

interface NotebookForm {
  entry_date: string;
  work_description: string;
  client_id: string;
  physical_file_id: string;
  remarks: string;
}

type NotebookView = NotebookEntry & {
  creator?: Profile | null;
  approved_by_profile?: Profile | null;
};

const statusOptions: NotebookStatus[] = ['draft', 'pending', 'approved'];
const today = () => new Date().toISOString().split('T')[0];
const blankForm = (): NotebookForm => ({ entry_date: today(), work_description: '', client_id: '', physical_file_id: '', remarks: '' });

function formatEntryDate(value?: string | null) {
  return value ? format(new Date(`${value.slice(0, 10)}T00:00:00`), 'dd MMM yyyy') : '-';
}

function formatDateTime(value?: string | null) {
  return value ? format(new Date(value), 'dd MMM yyyy HH:mm') : '-';
}

function textValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '-';
}

function escapeHtml(value: unknown) {
  return textValue(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] ?? character));
}

function relationName(value: unknown) {
  return (value as { full_name?: string; client_name?: string; file_name?: string } | null | undefined)?.full_name
    ?? (value as { client_name?: string } | null | undefined)?.client_name
    ?? (value as { file_name?: string } | null | undefined)?.file_name
    ?? '-';
}

export default function NotebookPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [entries, setEntries] = useState<NotebookView[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [files, setFiles] = useState<PhysicalFile[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | NotebookStatus>('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [adminView, setAdminView] = useState<'all' | 'pending'>('pending');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<NotebookView | null>(null);
  const [form, setForm] = useState<NotebookForm>(blankForm);
  const [submitAfterSave, setSubmitAfterSave] = useState(false);
  const [viewEntry, setViewEntry] = useState<NotebookView | null>(null);
  const [history, setHistory] = useState<NotebookEntryHistory[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  const loadEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from('notebook_entries')
      .select('*, creator:profiles!notebook_entries_created_by_fkey(full_name,role), approved_by_profile:profiles!notebook_entries_approved_by_fkey(full_name,role), client:clients(client_name,client_id), physical_file:physical_files(file_id,file_name,file_number)', { count: 'exact' })
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (isAdmin) {
      query = query.neq('status', 'draft');
      if (adminView === 'pending') query = query.eq('status', 'pending');
      if (staffFilter !== 'all') query = query.eq('created_by', staffFilter);
    } else {
      query = query.eq('created_by', user.id);
    }
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (clientFilter !== 'all') query = query.eq('client_id', clientFilter);
    if (dateFrom) query = query.gte('entry_date', dateFrom);
    if (dateTo) query = query.lte('entry_date', dateTo);

    const { data, error: loadError } = await query;
    if (loadError) {
      setError('Notebook entries could not be loaded.');
      setEntries([]);
    } else {
      setEntries((data as NotebookView[]) ?? []);
      setError('');
    }
    setLoading(false);
  }, [adminView, clientFilter, dateFrom, dateTo, isAdmin, staffFilter, statusFilter, user]);

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  useEffect(() => {
    async function loadLookups() {
      const [clientsResult, filesResult, staffResult] = await Promise.all([
        supabase.from('clients').select('id,client_id,client_name').eq('is_deleted', false).order('client_name'),
        supabase.from('physical_files').select('id,file_id,file_name,file_number,file_subject,client:clients(client_name,client_id)').eq('is_deleted', false).neq('status', 'archived').order('file_name'),
        supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      ]);
      setClients((clientsResult.data as Client[]) ?? []);
      setFiles((filesResult.data as unknown as PhysicalFile[]) ?? []);
      setStaff((staffResult.data as Profile[]) ?? []);
    }
    void loadLookups();
  }, []);

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter(entry => `${entry.work_description} ${entry.remarks ?? ''}`.toLowerCase().includes(term));
  }, [entries, search]);

  const pagedEntries = filteredEntries.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  function openNew() {
    setEditing(null);
    setForm(blankForm());
    setSubmitAfterSave(false);
    setError('');
    setFormOpen(true);
  }

  function openEdit(entry: NotebookView) {
    setEditing(entry);
    setForm({ entry_date: entry.entry_date.slice(0, 10), work_description: entry.work_description, client_id: entry.client_id ?? '', physical_file_id: entry.physical_file_id ?? '', remarks: entry.remarks ?? '' });
    setSubmitAfterSave(false);
    setError('');
    setFormOpen(true);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!form.work_description.trim()) { setError('Work description is required.'); return; }
    if (!form.entry_date) { setError('Date is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        entry_date: form.entry_date,
        work_description: form.work_description.trim(),
        client_id: form.client_id || null,
        physical_file_id: form.physical_file_id || null,
        remarks: form.remarks.trim() || null,
      };
      if (editing) {
        const { error: updateError } = await supabase.from('notebook_entries').update(payload).eq('id', editing.id);
        if (updateError) throw updateError;
        await logAudit({ action: 'UPDATE', module: 'notebook', record_id: editing.id, record_display: payload.work_description }, user?.id, profile?.full_name);
      } else {
        const { data: created, error: insertError } = await supabase.from('notebook_entries').insert({ ...payload, status: 'draft' }).select().maybeSingle();
        if (insertError || !created) throw insertError ?? new Error('Entry could not be created');
        if (submitAfterSave) {
          const { error: submitError } = await supabase.rpc('submit_notebook_entry', { p_entry_id: created.id });
          if (submitError) throw submitError;
        }
        await logAudit({ action: submitAfterSave ? 'SUBMIT' : 'CREATE', module: 'notebook', record_id: created.id, record_display: payload.work_description }, user?.id, profile?.full_name);
      }
      setFormOpen(false);
      await loadEntries();
    } catch (cause) {
      console.error('notebook save failed', cause);
      setError('The Notebook entry could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function approveEntry(entry: NotebookView) {
    setSaving(true);
    setError('');
    const { error: approveError } = await supabase.rpc('approve_notebook_entry', { p_entry_id: entry.id });
    if (approveError) {
      console.error('notebook approval failed', approveError);
      setError('The Notebook entry could not be approved. Please try again.');
    } else {
      await logAudit({ action: 'APPROVE', module: 'notebook', record_id: entry.id, record_display: entry.work_description }, user?.id, profile?.full_name);
      setViewEntry(previous => previous?.id === entry.id ? { ...previous, status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() } : previous);
      await loadEntries();
    }
    setSaving(false);
  }

  async function openHistory(entry: NotebookView) {
    const { data, error: historyError } = await supabase
      .from('notebook_entry_history')
      .select('*, editor:profiles!notebook_entry_history_edited_by_fkey(full_name,role)')
      .eq('entry_id', entry.id)
      .order('edited_at', { ascending: false });
    if (historyError) {
      setError('History could not be loaded.');
      return;
    }
    setHistory((data as NotebookEntryHistory[]) ?? []);
    setHistoryOpen(true);
  }

  function printEntry(entry: NotebookView) {
    const clientName = relationName(entry.client);
    const fileName = relationName(entry.physical_file);
    const staffName = relationName(entry.creator);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Notebook Entry</title><style>body{font-family:Roboto,Arial,sans-serif;color:#1f2937;margin:40px}h1{font-size:22px;margin-bottom:4px}.meta{color:#64748b;margin-bottom:28px}.grid{display:grid;grid-template-columns:180px 1fr;border-top:1px solid #cbd5e1}.row{display:contents}.label,.value{padding:12px 8px;border-bottom:1px solid #e2e8f0}.label{font-weight:700;color:#475569}.description{white-space:pre-wrap;line-height:1.6}</style></head><body><h1>Staff Notebook Entry</h1><div class="meta">Lakhia And Co. Office Management ERP</div><div class="grid"><div class="row"><div class="label">Date</div><div class="value">${escapeHtml(formatEntryDate(entry.entry_date))}</div></div><div class="row"><div class="label">Staff</div><div class="value">${escapeHtml(staffName)}</div></div><div class="row"><div class="label">Client</div><div class="value">${escapeHtml(clientName)}</div></div><div class="row"><div class="label">Physical File</div><div class="value">${escapeHtml(fileName)}</div></div><div class="row"><div class="label">Work Description</div><div class="value description">${escapeHtml(entry.work_description)}</div></div><div class="row"><div class="label">Remarks</div><div class="value description">${escapeHtml(entry.remarks || '-')}</div></div><div class="row"><div class="label">Status</div><div class="value">${escapeHtml(entry.status)}</div></div><div class="row"><div class="label">Approved</div><div class="value">${escapeHtml(entry.approved_at ? `${relationName(entry.approved_by_profile)} on ${formatDateTime(entry.approved_at)}` : '-')}</div></div></div><script>window.onload=()=>window.print()</script></body></html>`;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) { setError('Please allow pop-ups to print this entry.'); return; }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  }

  function clearFilters() {
    setSearch(''); setStatusFilter('all'); setStaffFilter('all'); setClientFilter('all'); setDateFrom(''); setDateTo(''); setPage(0);
  }

  const columns: PdfColumn[] = [
    { key: 'date', label: 'Date' }, { key: 'staff', label: 'Staff' }, { key: 'client', label: 'Client' },
    { key: 'file', label: 'Physical File' }, { key: 'description', label: 'Work Description' }, { key: 'remarks', label: 'Remarks' }, { key: 'status', label: 'Status' },
  ];
  const pdfRows: PdfRow[] = filteredEntries.map(entry => ({
    date: formatEntryDate(entry.entry_date), staff: relationName(entry.creator), client: relationName(entry.client), file: relationName(entry.physical_file),
    description: entry.work_description, remarks: entry.remarks ?? '-', status: entry.status,
  }));

  return (
    <Box sx={{ pb: { xs: 10, md: 0 } }}>
      <PageHeader
        title="Staff Notebook"
        subtitle={isAdmin ? `${filteredEntries.length} submitted entries` : `${filteredEntries.length} of your entries`}
        action={<Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={() => setPdfOpen(true)} disabled={filteredEntries.length === 0}>Export PDF</Button><Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Add New Entry</Button></Stack>}
      />

      {isAdmin && <Paper sx={{ mb: 2 }}><Tabs value={adminView} onChange={(_, value: 'all' | 'pending') => { setAdminView(value); setPage(0); }}><Tab value="pending" label="Pending Approvals" /><Tab value="all" label="Submitted & Approved" /></Tabs></Paper>}

      <Paper sx={{ mb: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <TextField placeholder="Search work or remarks..." value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} size="small" fullWidth sx={{ maxWidth: { md: 280 } }} InputProps={{ startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} /> }} />
          <TextField label="From" type="date" value={dateFrom} onChange={event => { setDateFrom(event.target.value); setPage(0); }} size="small" InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" value={dateTo} onChange={event => { setDateTo(event.target.value); setPage(0); }} size="small" InputLabelProps={{ shrink: true }} />
          {isAdmin && <TextField select label="Staff" value={staffFilter} onChange={event => { setStaffFilter(event.target.value); setPage(0); }} size="small" sx={{ minWidth: 170 }}><MenuItem value="all">All Staff</MenuItem>{staff.map(member => <MenuItem key={member.id} value={member.id}>{member.full_name}</MenuItem>)}</TextField>}
          <TextField select label="Client" value={clientFilter} onChange={event => { setClientFilter(event.target.value); setPage(0); }} size="small" sx={{ minWidth: 170 }}><MenuItem value="all">All Clients</MenuItem>{clients.map(client => <MenuItem key={client.id} value={client.id}>{client.client_name}</MenuItem>)}</TextField>
          <TextField select label="Status" value={statusFilter} onChange={event => { setStatusFilter(event.target.value as 'all' | NotebookStatus); setPage(0); }} size="small" sx={{ minWidth: 140 }}><MenuItem value="all">All Status</MenuItem>{statusOptions.filter(status => !isAdmin || status !== 'draft').map(status => <MenuItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</MenuItem>)}</TextField>
          {(search || dateFrom || dateTo || staffFilter !== 'all' || clientFilter !== 'all' || statusFilter !== 'all') && <Button onClick={clearFilters} size="small">Clear Filters</Button>}
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1050 }}>
            <TableHead><TableRow><TableCell>Date</TableCell>{isAdmin && <TableCell>Staff</TableCell>}<TableCell>Work Description</TableCell><TableCell>Client</TableCell><TableCell>Physical File</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={isAdmin ? 7 : 6} align="center" sx={{ py: 5 }}><CircularProgress size={24} /></TableCell></TableRow>
                : pagedEntries.length === 0 ? <TableRow><TableCell colSpan={isAdmin ? 7 : 6} align="center" sx={{ py: 5 }}><Typography color="text.secondary">No Notebook entries found.</Typography></TableCell></TableRow>
                : pagedEntries.map(entry => (
                  <TableRow key={entry.id} hover>
                    <TableCell>{formatEntryDate(entry.entry_date)}</TableCell>
                    {isAdmin && <TableCell>{relationName(entry.creator)}</TableCell>}
                    <TableCell><Typography variant="body2" fontWeight={600}>{entry.work_description}</Typography>{entry.remarks && <Typography variant="caption" color="text.secondary" noWrap>{entry.remarks}</Typography>}</TableCell>
                    <TableCell>{relationName(entry.client)}</TableCell>
                    <TableCell>{relationName(entry.physical_file)}</TableCell>
                    <TableCell><StatusChip status={entry.status} /></TableCell>
                    <TableCell align="right">
                      <Tooltip title="View"><IconButton size="small" onClick={() => { setViewEntry(entry); setError(''); }}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(entry)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Box>
        <TablePagination component="div" count={filteredEntries.length} page={page} onPageChange={(_, value) => setPage(value)} rowsPerPage={rowsPerPage} onRowsPerPageChange={event => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} />
      </Paper>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth>
        <Box component="form" onSubmit={handleSave}>
          <DialogTitle>{editing ? 'Edit Notebook Entry' : 'Add New Notebook Entry'}</DialogTitle>
          <DialogContent dividers>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}><TextField label="Date *" type="date" value={form.entry_date} onChange={event => setForm(previous => ({ ...previous, entry_date: event.target.value }))} fullWidth size="small" InputLabelProps={{ shrink: true }} /></Grid>
              <Grid size={{ xs: 12, sm: 8 }}><Autocomplete options={clients} getOptionLabel={client => `${client.client_id} - ${client.client_name}`} value={clients.find(client => client.id === form.client_id) ?? null} onChange={(_, client) => setForm(previous => ({ ...previous, client_id: client?.id ?? '' }))} renderInput={params => <TextField {...params} label="Client (optional)" size="small" />} /></Grid>
              <Grid size={12}><TextField label="Work Description *" value={form.work_description} onChange={event => setForm(previous => ({ ...previous, work_description: event.target.value }))} fullWidth multiline minRows={3} size="small" /></Grid>
              <Grid size={12}><Autocomplete options={files} getOptionLabel={file => `${file.file_id} - ${file.file_name}`} value={files.find(file => file.id === form.physical_file_id) ?? null} onChange={(_, file) => setForm(previous => ({ ...previous, physical_file_id: file?.id ?? '' }))} filterOptions={(options, state) => options.filter(file => `${file.file_id} ${file.file_name} ${file.file_number ?? ''} ${file.file_subject ?? ''}`.toLowerCase().includes(state.inputValue.toLowerCase()))} renderInput={params => <TextField {...params} label="Physical File (optional)" size="small" />} /></Grid>
              <Grid size={12}><TextField label="Remarks" value={form.remarks} onChange={event => setForm(previous => ({ ...previous, remarks: event.target.value }))} fullWidth multiline minRows={2} size="small" /></Grid>
              {!editing && <Grid size={12}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button type="submit" variant="outlined" disabled={saving} onClick={() => setSubmitAfterSave(false)}>Save as Draft</Button><Button type="submit" variant="contained" disabled={saving} onClick={() => setSubmitAfterSave(true)}>Submit for Approval</Button></Stack></Grid>}
            </Grid>
          </DialogContent>
          <DialogActions>{editing && <Button type="submit" variant="contained" disabled={saving}>Save Changes</Button>}<Button onClick={() => setFormOpen(false)}>Cancel</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(viewEntry)} onClose={() => setViewEntry(null)} maxWidth="md" fullWidth>
        <DialogTitle>Notebook Entry</DialogTitle>
        <DialogContent dividers>
          {viewEntry && <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><Typography variant="overline" color="text.secondary">Date</Typography><Typography>{formatEntryDate(viewEntry.entry_date)}</Typography></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><Typography variant="overline" color="text.secondary">Staff</Typography><Typography>{relationName(viewEntry.creator)}</Typography></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><Typography variant="overline" color="text.secondary">Client</Typography><Typography>{relationName(viewEntry.client)}</Typography></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><Typography variant="overline" color="text.secondary">Physical File</Typography><Typography>{relationName(viewEntry.physical_file)}</Typography></Grid>
            <Grid size={12}><Divider /><Typography variant="overline" color="text.secondary">Work Description</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{viewEntry.work_description}</Typography></Grid>
            <Grid size={12}><Typography variant="overline" color="text.secondary">Remarks</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{viewEntry.remarks || '-'}</Typography></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><Typography variant="overline" color="text.secondary">Status</Typography><Box><StatusChip status={viewEntry.status} /></Box></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><Typography variant="overline" color="text.secondary">Approved</Typography><Typography>{viewEntry.approved_at ? formatDateTime(viewEntry.approved_at) : '-'}</Typography></Grid>
          </Grid>}
        </DialogContent>
        <DialogActions>
          {viewEntry && <><Button startIcon={<HistoryIcon />} onClick={() => void openHistory(viewEntry)}>History</Button><Button startIcon={<PrintIcon />} onClick={() => printEntry(viewEntry)}>Print</Button><Button startIcon={<EditIcon />} onClick={() => { openEdit(viewEntry); setViewEntry(null); }}>Edit</Button>{isAdmin && viewEntry.status === 'pending' && <Button startIcon={<CheckCircleIcon />} variant="contained" color="success" onClick={() => void approveEntry(viewEntry)} disabled={saving}>Approve</Button>}</>}
          <Button onClick={() => setViewEntry(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Notebook Edit History</DialogTitle>
        <DialogContent dividers>
          {history.length === 0 ? <Typography color="text.secondary">No edits recorded for this entry.</Typography> : <Stack spacing={2}>{history.map(item => <Paper key={item.id} variant="outlined" sx={{ p: 2 }}><Stack direction="row" justifyContent="space-between"><Typography variant="subtitle2">{relationName(item.editor)}</Typography><Typography variant="caption" color="text.secondary">{formatDateTime(item.edited_at)}</Typography></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Previous description: {textValue(item.old_values.work_description)}</Typography><Typography variant="body2">Current description: {textValue(item.new_values.work_description)}</Typography></Paper>)}</Stack>}
        </DialogContent>
        <DialogActions><Button onClick={() => setHistoryOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <PdfExportDialog open={pdfOpen} onClose={() => setPdfOpen(false)} title="Staff Notebook" columns={columns} rows={pdfRows} filtersDescription={[search && `Search: ${search}`, dateFrom && `From: ${dateFrom}`, dateTo && `To: ${dateTo}`, clientFilter !== 'all' && `Client: ${clients.find(client => client.id === clientFilter)?.client_name ?? ''}`, statusFilter !== 'all' && `Status: ${statusFilter}`].filter(Boolean).join(', ') || undefined} />
    </Box>
  );
}
