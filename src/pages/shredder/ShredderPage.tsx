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
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import ArchiveIcon from '@mui/icons-material/Archive';
import RestoreIcon from '@mui/icons-material/Restore';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import FileViewDialog from '../../components/files/FileViewDialog';
import PdfExportDialog, { type PdfColumn, type PdfRow } from '../../components/common/PdfExportDialog';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../lib/audit';
import type { PhysicalFile, Cabinet, Client, RetentionRule } from '../../types';
import { format } from 'date-fns';

function parseYear(ayOrFy: string | undefined | null): number | null {
  if (!ayOrFy) return null;
  const m = ayOrFy.match(/(\d{4})/);
  return m ? parseInt(m[1]) : null;
}

const DEFAULT_RULE_ID = 'default-10';

export default function ShredderPage() {
  const { profile, user } = useAuth();
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  const [tab, setTab] = useState(0);
  const [files, setFiles] = useState<PhysicalFile[]>([]);
  const [archivedFiles, setArchivedFiles] = useState<PhysicalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<RetentionRule[]>([]);
  const [activeRuleId, setActiveRuleId] = useState<string>(DEFAULT_RULE_ID);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [cabinetFilter, setCabinetFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewFileId, setViewFileId] = useState<string | null>(null);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editRule, setEditRule] = useState<RetentionRule | null>(null);
  const [ruleForm, setRuleForm] = useState({ name: '', years: 10 });
  const [ruleError, setRuleError] = useState('');
  const [restoreDialog, setRestoreDialog] = useState<{ open: boolean; file: PhysicalFile | null }>({ open: false, file: null });
  const [pdfOpen, setPdfOpen] = useState(false);

  const currentYear = new Date().getFullYear();

  const activeRule = rules.find(r => r.id === activeRuleId);
  const retentionYears = activeRule?.years ?? 10;
  const cutoffYear = currentYear - retentionYears;

  useEffect(() => {
    supabase.from('retention_rules').select('*').order('is_default', { ascending: false }).then(r => {
      const loaded = (r.data ?? []) as RetentionRule[];
      setRules(loaded);
      if (loaded.length > 0 && !loaded.find(r => r.id === activeRuleId)) {
        setActiveRuleId(loaded[0].id);
      }
    });
    supabase.from('cabinets').select('*').eq('is_deleted', false).order('cabinet_name').then(r => setCabinets(r.data ?? []));
    supabase.from('clients').select('id, client_name, client_id').eq('is_deleted', false).eq('status', 'active').order('client_name').then(r => setClients((r.data ?? []) as Client[]));
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('physical_files')
      .select('*, client:clients(client_name,client_id), cabinet:cabinets(cabinet_name), current_holder:employees(full_name), archived_by_employee:employees!physical_files_archived_by_fkey(full_name)')
      .eq('is_deleted', false)
      .in('status', ['available', 'in_use', 'sent_outside', 'missing', 'archived'])
      .order('created_at', { ascending: false });
    setFiles((data as PhysicalFile[]) ?? []);
    setLoading(false);
  }, []);

  const loadArchivedFiles = useCallback(async () => {
    const { data } = await supabase.from('physical_files')
      .select('*, client:clients(client_name,client_id), cabinet:cabinets(cabinet_name), archived_by_employee:employees!physical_files_archived_by_fkey(full_name)')
      .eq('is_deleted', false)
      .eq('status', 'archived')
      .order('archived_at', { ascending: false });
    setArchivedFiles((data as PhysicalFile[]) ?? []);
  }, []);

  useEffect(() => { loadFiles(); loadArchivedFiles(); }, [loadFiles, loadArchivedFiles]);

  const activeFiles = useMemo(() => files.filter(f => f.status !== 'archived'), [files]);

  const eligibleFiles = useMemo(() => {
    return activeFiles.filter(f => {
      const yearVal = parseYear(f.assessment_year) ?? parseYear(f.financial_year);
      if (yearVal === null) return false;
      return yearVal < cutoffYear;
    });
  }, [activeFiles, cutoffYear]);

  const missingAyFyFiles = useMemo(() => {
    return activeFiles.filter(f => {
      const ay = parseYear(f.assessment_year);
      const fy = parseYear(f.financial_year);
      return ay === null && fy === null;
    });
  }, [activeFiles]);

  const applyFilters = useCallback((list: PhysicalFile[]) => {
    let filtered = list;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(f =>
        (f.file_name ?? '').toLowerCase().includes(s) ||
        (f.file_id ?? '').toLowerCase().includes(s) ||
        (f.file_number ?? '').toLowerCase().includes(s));
    }
    if (clientFilter !== 'all') filtered = filtered.filter(f => f.client_id === clientFilter);
    if (cabinetFilter !== 'all') filtered = filtered.filter(f => f.cabinet_id === cabinetFilter);
    return filtered;
  }, [search, clientFilter, cabinetFilter]);

  const displayList = tab === 0 ? applyFilters(eligibleFiles) : tab === 1 ? applyFilters(missingAyFyFiles) : applyFilters(archivedFiles);
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
    setClientFilter('all');
    setCabinetFilter('all');
    setPage(0);
  }

  const hasActiveFilters = search || clientFilter !== 'all' || cabinetFilter !== 'all';

  async function handleArchive() {
    if (!archiveReason.trim()) { setArchiveError('Reason/Remarks is mandatory.'); return; }
    setArchiving(true);
    setArchiveError('');
    try {
      const fileIds = Array.from(selected);
      const { data: openMovements } = await supabase.from('file_movements')
        .select('file_id').in('file_id', fileIds).eq('status', 'out');
      const blockedIds = new Set((openMovements ?? []).map((m: { file_id: string }) => m.file_id));
      if (blockedIds.size > 0) {
        const blockedFiles = activeFiles.filter(f => blockedIds.has(f.id));
        setArchiveError(`The following files are currently issued and cannot be archived until returned: ${blockedFiles.map(f => f.file_id).join(', ')}`);
        return;
      }
      const now = new Date().toISOString();
      const ruleName = activeRule?.name ?? 'Default (10 Years)';
      const ruleId = activeRule?.id ?? null;
      for (const id of fileIds) {
        await supabase.from('physical_files').update({
          status: 'archived',
          archived_at: now,
          archived_by: user?.id,
          archive_reason: archiveReason.trim(),
          retention_rule_id: ruleId,
          retention_rule_name: ruleName,
          updated_by: user?.id,
          updated_at: now,
        }).eq('id', id);
        const f = activeFiles.find(f => f.id === id);
        if (f) {
          await logAudit({ action: 'ARCHIVE', module: 'shredder', record_id: id, record_display: f.file_name, notes: archiveReason.trim() }, user?.id, profile?.full_name);
        }
      }
      setArchiveOpen(false);
      setArchiveReason('');
      setSelected(new Set());
      loadFiles();
      loadArchivedFiles();
    } catch (err: unknown) {
      setArchiveError(err instanceof Error ? err.message : 'Archive failed');
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore() {
    if (!restoreDialog.file) return;
    const file = restoreDialog.file;
    await supabase.from('physical_files').update({
      status: 'available',
      archived_at: null,
      archived_by: null,
      archive_reason: null,
      retention_rule_id: null,
      retention_rule_name: null,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    }).eq('id', file.id);
    await logAudit({ action: 'RESTORE', module: 'shredder', record_id: file.id, record_display: file.file_name }, user?.id, profile?.full_name);
    setRestoreDialog({ open: false, file: null });
    loadFiles();
    loadArchivedFiles();
  }

  function openRuleDialog(rule: RetentionRule | null) {
    setEditRule(rule);
    if (rule) {
      setRuleForm({ name: rule.name, years: rule.years });
    } else {
      setRuleForm({ name: '', years: 5 });
    }
    setRuleError('');
    setRuleDialogOpen(true);
  }

  async function handleSaveRule() {
    if (!ruleForm.name.trim()) { setRuleError('Rule name is required.'); return; }
    if (!ruleForm.years || ruleForm.years < 1) { setRuleError('Years must be at least 1.'); return; }
    if (editRule) {
      await supabase.from('retention_rules').update({ name: ruleForm.name.trim(), years: ruleForm.years, updated_at: new Date().toISOString() }).eq('id', editRule.id);
    } else {
      await supabase.from('retention_rules').insert({ name: ruleForm.name.trim(), years: ruleForm.years, is_default: false, created_by: user?.id });
    }
    setRuleDialogOpen(false);
    const { data } = await supabase.from('retention_rules').select('*').order('is_default', { ascending: false });
    setRules((data ?? []) as RetentionRule[]);
  }

  async function handleDeleteRule(rule: RetentionRule) {
    if (rule.is_default) return;
    await supabase.from('retention_rules').delete().eq('id', rule.id);
    if (activeRuleId === rule.id) setActiveRuleId(DEFAULT_RULE_ID);
    const { data } = await supabase.from('retention_rules').select('*').order('is_default', { ascending: false });
    setRules((data ?? []) as RetentionRule[]);
  }

  const tableColumns = ['File ID', 'File Name', 'File Number', 'File Subject', 'Client', 'AY', 'FY', 'Cabinet', 'Shelf', 'Status'];
  const historyColumns = ['File ID', 'File Name', 'File Number', 'File Subject', 'Client', 'AY', 'FY', 'Cabinet', 'Retention Rule', 'Archived Date', 'Archived By'];

  return (
    <Box>
      <PageHeader
        title="Shredder / File Archiving"
        subtitle={`${eligibleFiles.length} eligible · ${archivedFiles.length} archived · Retention: ${retentionYears} years (cutoff: before ${cutoffYear})`}
        action={canEdit ? (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openRuleDialog(null)}>Add Custom Rule</Button>
            <Button variant="outlined" onClick={() => setPdfOpen(true)}>Export PDF</Button>
            {tab === 0 && selected.size > 0 && (
              <Button startIcon={<ArchiveIcon />} variant="contained" color="error" onClick={() => { setArchiveError(''); setArchiveOpen(true); }}>
                Archive {selected.size} file{selected.size > 1 ? 's' : ''}
              </Button>
            )}
          </Stack>
        ) : undefined}
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        Files are eligible for archiving when their Assessment Year (or Financial Year if AY is missing) is older than {currentYear} minus {retentionYears} = before {cutoffYear}. Archived files are removed from all active lists but remain fully viewable and restorable here. Nothing is ever deleted.
      </Alert>

      <Paper sx={{ mb: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField select value={activeRuleId} onChange={e => { setActiveRuleId(e.target.value); setPage(0); setSelected(new Set()); }} size="small" label="Retention Rule" sx={{ minWidth: 200 }}>
            {rules.map(r => <MenuItem key={r.id} value={r.id}>{r.name} ({r.years} years){r.is_default ? ' ★' : ''}</MenuItem>)}
          </TextField>
          <TextField
            placeholder="Search file name / number..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          <TextField select value={clientFilter} onChange={e => { setClientFilter(e.target.value); setPage(0); }} size="small" label="Client" sx={{ minWidth: 150 }}>
            <MenuItem value="all">All Clients</MenuItem>
            {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.client_name}</MenuItem>)}
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
        <Tab label={`Eligible for Archive (${eligibleFiles.length})`} />
        <Tab label={`Missing AY/FY (${missingAyFyFiles.length})`} />
        <Tab label={`Archive History (${archivedFiles.length})`} />
      </Tabs>

      <Paper>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: tab === 2 ? 1200 : 1000 }}>
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
                {(tab === 2 ? historyColumns : tableColumns).map(col => <TableCell key={col}>{col}</TableCell>)}
                {tab === 2 && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={tab === 2 ? historyColumns.length + 2 : tableColumns.length + 1} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : pagedFiles.length === 0 ? (
                <TableRow><TableCell colSpan={tab === 2 ? historyColumns.length + 2 : tableColumns.length + 1} align="center" sx={{ py: 4 }}><Typography color="text.secondary">
                  {tab === 0 ? 'No eligible files found' : tab === 1 ? 'No files with missing AY/FY' : 'No archived files found'}
                </Typography></TableCell></TableRow>
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
                  {tab === 2 ? (
                    <>
                      <TableCell><Typography variant="body2">{f.retention_rule_name ?? '-'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{f.archived_at ? format(new Date(f.archived_at), 'dd MMM yyyy') : '-'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{(f as unknown as { archived_by_employee?: { full_name: string } }).archived_by_employee?.full_name ?? '-'}</Typography></TableCell>
                    </>
                  ) : (
                    <TableCell><StatusChip status={f.status} /></TableCell>
                  )}
                  {tab === 2 && (
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="View"><IconButton size="small" onClick={() => { setViewFileId(f.id); setViewOpen(true); }}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                      {canEdit && (
                        <Tooltip title="Restore to Active"><IconButton size="small" color="success" onClick={() => setRestoreDialog({ open: true, file: f })}><RestoreIcon fontSize="small" /></IconButton></Tooltip>
                      )}
                    </TableCell>
                  )}
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

      {rules.length > 1 && canEdit && (
        <Paper sx={{ mt: 2, p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Custom Retention Rules</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {rules.map(r => (
              <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, border: 1, borderColor: 'divider', borderRadius: 1, px: 1, py: 0.5 }}>
                <Typography variant="caption">{r.name} ({r.years} yr){r.is_default ? ' ★' : ''}</Typography>
                {!r.is_default && (
                  <>
                    <IconButton size="small" onClick={() => openRuleDialog(r)} sx={{ p: 0.25 }}><EditIcon sx={{ fontSize: 14 }} /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDeleteRule(r)} sx={{ p: 0.25 }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>
                  </>
                )}
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      <Dialog open={archiveOpen} onClose={() => setArchiveOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Archive {selected.size} File{selected.size > 1 ? 's' : ''}</DialogTitle>
        <DialogContent dividers>
          {archiveError && <Alert severity="error" sx={{ mb: 2 }}>{archiveError}</Alert>}
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will archive the selected files using the "{activeRule?.name ?? 'Default'}" rule ({retentionYears} years). They will be removed from all active lists but remain fully viewable and restorable in Archive History. This action can be undone via Restore.
          </Alert>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                label="Reason / Remarks *"
                value={archiveReason}
                onChange={e => setArchiveReason(e.target.value)}
                fullWidth size="small" multiline rows={3}
                error={!archiveReason.trim() && archiveError !== ''}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveOpen(false)}>Cancel</Button>
          <Button onClick={handleArchive} variant="contained" color="error" disabled={archiving}
            startIcon={archiving ? <CircularProgress size={16} color="inherit" /> : <ArchiveIcon />}>
            Confirm Archive
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={ruleDialogOpen} onClose={() => setRuleDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editRule ? 'Edit Retention Rule' : 'Add Custom Retention Rule'}</DialogTitle>
        <DialogContent dividers>
          {ruleError && <Alert severity="error" sx={{ mb: 2 }}>{ruleError}</Alert>}
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField label="Rule Name *" value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))} fullWidth size="small" placeholder="e.g. GST Records" />
            </Grid>
            <Grid size={12}>
              <TextField label="Retention Years *" type="number" value={ruleForm.years} onChange={e => setRuleForm(p => ({ ...p, years: parseInt(e.target.value) || 0 }))} fullWidth size="small" inputProps={{ min: 1 }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuleDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveRule} variant="contained">{editRule ? 'Save' : 'Add Rule'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={restoreDialog.open} onClose={() => setRestoreDialog({ open: false, file: null })} maxWidth="xs" fullWidth>
        <DialogTitle>Restore Archived File</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info">
            Restore "{restoreDialog.file?.file_name}" ({restoreDialog.file?.file_id}) back to active status? It will reappear in all active lists with its original data and movement history intact.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialog({ open: false, file: null })}>Cancel</Button>
          <Button onClick={handleRestore} variant="contained" color="success" startIcon={<RestoreIcon />}>Restore</Button>
        </DialogActions>
      </Dialog>

      <FileViewDialog open={viewOpen} fileId={viewFileId} onClose={() => setViewOpen(false)} />

      <PdfExportDialog
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        title={tab === 2 ? 'Shredder Archive History' : 'Shredder Eligible Files'}
        columns={tab === 2 ? [
          { key: 'file_id', label: 'File ID' },
          { key: 'file_name', label: 'File Name' },
          { key: 'file_number', label: 'File Number' },
          { key: 'file_subject', label: 'File Subject' },
          { key: 'client_name', label: 'Client' },
          { key: 'assessment_year', label: 'AY' },
          { key: 'financial_year', label: 'FY' },
          { key: 'cabinet_name', label: 'Cabinet' },
          { key: 'retention_rule_name', label: 'Retention Rule' },
          { key: 'archived_date', label: 'Archived Date' },
          { key: 'archived_by', label: 'Archived By' },
        ] as PdfColumn[] : [
          { key: 'file_id', label: 'File ID' },
          { key: 'file_name', label: 'File Name' },
          { key: 'file_number', label: 'File Number' },
          { key: 'file_subject', label: 'File Subject' },
          { key: 'client_name', label: 'Client' },
          { key: 'assessment_year', label: 'AY' },
          { key: 'financial_year', label: 'FY' },
          { key: 'cabinet_name', label: 'Cabinet' },
          { key: 'shelf', label: 'Shelf' },
          { key: 'status', label: 'Status' },
        ] as PdfColumn[]}
        rows={(tab === 2 ? archivedFiles : tab === 0 ? eligibleFiles : missingAyFyFiles).map(f => ({
          file_id: f.file_id,
          file_name: f.file_name,
          file_number: f.file_number || '-',
          file_subject: f.file_subject || '-',
          client_name: (f.client as { client_name: string } | undefined)?.client_name ?? '-',
          assessment_year: f.assessment_year || '-',
          financial_year: f.financial_year || '-',
          cabinet_name: (f.cabinet as { cabinet_name: string } | undefined)?.cabinet_name ?? '-',
          shelf: f.shelf || '-',
          status: f.status.replace(/_/g, ' '),
          retention_rule_name: f.retention_rule_name ?? '-',
          archived_date: f.archived_at ? format(new Date(f.archived_at), 'dd MMM yyyy') : '-',
          archived_by: (f as unknown as { archived_by_employee?: { full_name: string } }).archived_by_employee?.full_name ?? '-',
        })) as PdfRow[]}
        filtersDescription={hasActiveFilters ? 'Active filters applied' : undefined}
      />
    </Box>
  );
}
