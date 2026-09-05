import { useEffect, useState, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CircularProgress from '@mui/material/CircularProgress';
import Checkbox from '@mui/material/Checkbox';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Grid from '@mui/material/Grid';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import FileViewDialog from '../../components/files/FileViewDialog';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../lib/audit';
import type { PhysicalFile, Cabinet, Client, FinancialYear, AssessmentYear, CompanySettings } from '../../types';

function parseYear(ayOrFy: string | undefined | null): number | null {
  if (!ayOrFy) return null;
  const m = ayOrFy.match(/(\d{4})/);
  return m ? parseInt(m[1]) : null;
}

export default function ShredderPage() {
  const { profile, user } = useAuth();
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  const [tab, setTab] = useState(0);
  const [files, setFiles] = useState<PhysicalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [retentionYears, setRetentionYears] = useState(8);
  const [search, setSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [ayFilter, setAyFilter] = useState('all');
  const [fyFilter, setFyFilter] = useState('all');
  const [cabinetFilter, setCabinetFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [disposeReason, setDisposeReason] = useState('');
  const [disposing, setDisposing] = useState(false);
  const [disposeError, setDisposeError] = useState('');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewFileId, setViewFileId] = useState<string | null>(null);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [fyOptions, setFyOptions] = useState<FinancialYear[]>([]);
  const [ayOptions, setAyOptions] = useState<AssessmentYear[]>([]);

  const currentYear = new Date().getFullYear();
  const cutoffYear = currentYear - retentionYears;

  useEffect(() => {
    supabase.from('company_settings').select('*').limit(1).maybeSingle().then(({ data }) => {
      if (data) setRetentionYears((data as CompanySettings).retention_years ?? 8);
    });
    supabase.from('cabinets').select('*').eq('is_deleted', false).order('cabinet_name').then(r => setCabinets(r.data ?? []));
    supabase.from('clients').select('id, client_name, client_id').eq('is_deleted', false).eq('status', 'active').order('client_name').then(r => setClients((r.data ?? []) as Client[]));
    supabase.from('financial_years').select('*').order('start_year', { ascending: false }).then(r => setFyOptions((r.data ?? []) as FinancialYear[]));
    supabase.from('assessment_years').select('*').order('start_year', { ascending: false }).then(r => setAyOptions((r.data ?? []) as AssessmentYear[]));
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('physical_files')
      .select('*, client:clients(client_name,client_id), cabinet:cabinets(cabinet_name), current_holder:employees(full_name)')
      .eq('is_deleted', false)
      .in('status', ['available', 'in_use', 'sent_outside', 'archived', 'missing'])
      .order('created_at', { ascending: false });
    setFiles((data as PhysicalFile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const eligibleFiles = useMemo(() => {
    return files.filter(f => {
      const yearVal = parseYear(f.assessment_year) ?? parseYear(f.financial_year);
      if (yearVal === null) return false;
      return yearVal < cutoffYear;
    });
  }, [files, cutoffYear]);

  const missingAyFyFiles = useMemo(() => {
    return files.filter(f => {
      const ay = parseYear(f.assessment_year);
      const fy = parseYear(f.financial_year);
      return ay === null && fy === null;
    });
  }, [files]);

  const applyFilters = useCallback((list: PhysicalFile[]) => {
    let filtered = list;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(f =>
        (f.file_name ?? '').toLowerCase().includes(s) ||
        (f.file_id ?? '').toLowerCase().includes(s) ||
        (f.file_number ?? '').toLowerCase().includes(s));
    }
    if (subjectSearch) {
      const s = subjectSearch.toLowerCase();
      filtered = filtered.filter(f => (f.file_subject ?? '').toLowerCase().includes(s));
    }
    if (clientFilter !== 'all') filtered = filtered.filter(f => f.client_id === clientFilter);
    if (ayFilter !== 'all') filtered = filtered.filter(f => f.assessment_year === ayFilter);
    if (fyFilter !== 'all') filtered = filtered.filter(f => f.financial_year === fyFilter);
    if (cabinetFilter !== 'all') filtered = filtered.filter(f => f.cabinet_id === cabinetFilter);
    return filtered;
  }, [search, subjectSearch, clientFilter, ayFilter, fyFilter, cabinetFilter]);

  const displayList = applyFilters(tab === 0 ? eligibleFiles : missingAyFyFiles);
  const pagedFiles = displayList.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === pagedFiles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pagedFiles.map(f => f.id)));
    }
  }

  function clearFilters() {
    setSearch('');
    setSubjectSearch('');
    setClientFilter('all');
    setAyFilter('all');
    setFyFilter('all');
    setCabinetFilter('all');
    setPage(0);
  }

  const hasActiveFilters = search || subjectSearch || clientFilter !== 'all' || ayFilter !== 'all' || fyFilter !== 'all' || cabinetFilter !== 'all';

  async function handleDispose() {
    if (!disposeReason.trim()) { setDisposeError('Reason/Remarks is mandatory.'); return; }
    setDisposing(true);
    setDisposeError('');
    try {
      const fileIds = Array.from(selected);
      const { data: openMovements } = await supabase.from('file_movements')
        .select('file_id')
        .in('file_id', fileIds)
        .eq('status', 'out');
      const blockedIds = new Set((openMovements ?? []).map((m: { file_id: string }) => m.file_id));
      if (blockedIds.size > 0) {
        const blockedFiles = files.filter(f => blockedIds.has(f.id));
        setDisposeError(`The following files are currently issued and cannot be marked for disposal until returned: ${blockedFiles.map(f => f.file_id).join(', ')}`);
        return;
      }
      const now = new Date().toISOString();
      for (const id of fileIds) {
        await supabase.from('physical_files').update({
          status: 'disposed',
          disposed_at: now,
          disposed_by: user?.id,
          dispose_reason: disposeReason.trim(),
          updated_by: user?.id,
          updated_at: now,
        }).eq('id', id);
        const f = files.find(f => f.id === id);
        if (f) {
          await logAudit({ action: 'DISPOSE', module: 'shredder', record_id: id, record_display: f.file_name, notes: disposeReason.trim() }, user?.id, profile?.full_name);
        }
      }
      setDisposeOpen(false);
      setDisposeReason('');
      setSelected(new Set());
      loadFiles();
    } catch (err: unknown) {
      setDisposeError(err instanceof Error ? err.message : 'Disposal failed');
    } finally {
      setDisposing(false);
    }
  }

  const tableColumns = ['File ID', 'File Name', 'File Number', 'File Subject', 'Client', 'AY', 'FY', 'Cabinet', 'Shelf', 'Status'];

  return (
    <Box>
      <PageHeader
        title="Shredder / Old File Disposal"
        subtitle={`${eligibleFiles.length} eligible · ${missingAyFyFiles.length} missing AY/FY · Retention: ${retentionYears} years (cutoff: before ${cutoffYear})`}
        action={canEdit && selected.size > 0 ? (
          <Button startIcon={<DeleteSweepIcon />} variant="contained" color="error" onClick={() => { setDisposeError(''); setDisposeOpen(true); }}>
            Dispose {selected.size} file{selected.size > 1 ? 's' : ''}
          </Button>
        ) : undefined}
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        Files are eligible for disposal when their Assessment Year (or Financial Year if AY is missing) is older than {currentYear} minus {retentionYears} = before {cutoffYear}. Files with no AY and no FY are listed separately for manual review. Disposal changes status only — nothing is ever deleted.
      </Alert>

      <Paper sx={{ mb: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <TextField
            placeholder="Search file name / number..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          <TextField
            placeholder="Search subject..."
            value={subjectSearch} onChange={e => { setSubjectSearch(e.target.value); setPage(0); }}
            size="small" sx={{ minWidth: { xs: '100%', sm: 180 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          <TextField select value={clientFilter} onChange={e => { setClientFilter(e.target.value); setPage(0); }} size="small" label="Client" sx={{ minWidth: 150 }}>
            <MenuItem value="all">All Clients</MenuItem>
            {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.client_name}</MenuItem>)}
          </TextField>
          <TextField select value={ayFilter} onChange={e => { setAyFilter(e.target.value); setPage(0); }} size="small" label="AY" sx={{ minWidth: 110 }}>
            <MenuItem value="all">All AY</MenuItem>
            {ayOptions.map(ay => <MenuItem key={ay.id} value={ay.label}>{ay.label}</MenuItem>)}
          </TextField>
          <TextField select value={fyFilter} onChange={e => { setFyFilter(e.target.value); setPage(0); }} size="small" label="FY" sx={{ minWidth: 110 }}>
            <MenuItem value="all">All FY</MenuItem>
            {fyOptions.map(fy => <MenuItem key={fy.id} value={fy.label}>{fy.label}</MenuItem>)}
          </TextField>
          <TextField select value={cabinetFilter} onChange={e => { setCabinetFilter(e.target.value); setPage(0); }} size="small" label="Cabinet" sx={{ minWidth: 140 }}>
            <MenuItem value="all">All Cabinets</MenuItem>
            {cabinets.map(c => <MenuItem key={c.id} value={c.id}>{c.cabinet_name}</MenuItem>)}
          </TextField>
          {hasActiveFilters && (
            <Button startIcon={<ClearIcon />} onClick={clearFilters} size="small" sx={{ alignSelf: 'center', whiteSpace: 'nowrap' }}>Clear Filters</Button>
          )}
        </Stack>
      </Paper>

      <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(0); setSelected(new Set()); }} sx={{ mb: 1 }}>
        <Tab label={`Eligible for Disposal (${eligibleFiles.length})`} />
        <Tab label={`Missing AY/FY - Manual Review (${missingAyFyFiles.length})`} />
      </Tabs>

      <Paper>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1000 }}>
            <TableHead>
              <TableRow>
                {canEdit && tab === 0 && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.size > 0 && selected.size < pagedFiles.length}
                      checked={pagedFiles.length > 0 && selected.size === pagedFiles.length}
                      onChange={toggleSelectAll}
                    />
                  </TableCell>
                )}
                {tableColumns.map(col => <TableCell key={col}>{col}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={tableColumns.length + 1} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : pagedFiles.length === 0 ? (
                <TableRow><TableCell colSpan={tableColumns.length + 1} align="center" sx={{ py: 4 }}><Typography color="text.secondary">{tab === 0 ? 'No eligible files found' : 'No files with missing AY/FY'}</Typography></TableCell></TableRow>
              ) : pagedFiles.map(f => (
                <TableRow key={f.id} hover sx={{ cursor: 'pointer' }} onClick={() => { setViewFileId(f.id); setViewOpen(true); }}>
                  {canEdit && tab === 0 && (
                    <TableCell padding="checkbox" onClick={(e) => { e.stopPropagation(); toggleSelect(f.id); }}>
                      <Checkbox checked={selected.has(f.id)} />
                    </TableCell>
                  )}
                  <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{f.file_id}</Typography></TableCell>
                  <TableCell><Typography variant="body2" fontWeight={500}>{f.file_name}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.file_number || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.file_subject || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{(f.client as { client_name: string } | undefined)?.client_name ?? '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.assessment_year || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.financial_year || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{(f.cabinet as { cabinet_name: string } | undefined)?.cabinet_name ?? '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.shelf || '-'}</Typography></TableCell>
                  <TableCell><StatusChip status={f.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <TablePagination
          component="div"
          count={displayList.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      <Dialog open={disposeOpen} onClose={() => setDisposeOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Mark {selected.size} File{selected.size > 1 ? 's' : ''} for Disposal</DialogTitle>
        <DialogContent dividers>
          {disposeError && <Alert severity="error" sx={{ mb: 2 }}>{disposeError}</Alert>}
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will change the file status to "Disposed". The records will be preserved permanently in the Disposal History. This action cannot be undone.
          </Alert>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                label="Reason / Remarks *"
                value={disposeReason}
                onChange={e => setDisposeReason(e.target.value)}
                fullWidth
                size="small"
                multiline
                rows={3}
                error={!disposeReason.trim() && disposeError !== ''}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisposeOpen(false)}>Cancel</Button>
          <Button onClick={handleDispose} variant="contained" color="error" disabled={disposing}
            startIcon={disposing ? <CircularProgress size={16} color="inherit" /> : <DeleteSweepIcon />}>
            Confirm Disposal
          </Button>
        </DialogActions>
      </Dialog>

      <FileViewDialog open={viewOpen} fileId={viewFileId} onClose={() => setViewOpen(false)} />
    </Box>
  );
}
