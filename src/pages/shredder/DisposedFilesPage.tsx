import { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import RestoreIcon from '@mui/icons-material/Restore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import PageHeader from '../../components/common/PageHeader';
import FileViewDialog from '../../components/files/FileViewDialog';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../lib/audit';
import type { PhysicalFile } from '../../types';
import { format } from 'date-fns';

interface ArchivedFile extends PhysicalFile {
  archived_by_employee?: { full_name: string } | null;
}

export default function DisposedFilesPage() {
  const { profile, user } = useAuth();
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';
  const [files, setFiles] = useState<ArchivedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewFileId, setViewFileId] = useState<string | null>(null);
  const [restoreDialog, setRestoreDialog] = useState<{ open: boolean; file: ArchivedFile | null }>({ open: false, file: null });

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('physical_files')
      .select('*, client:clients(client_name,client_id), cabinet:cabinets(cabinet_name), archived_by_employee:employees!physical_files_archived_by_fkey(full_name)')
      .eq('is_deleted', false)
      .eq('status', 'archived')
      .order('archived_at', { ascending: false });
    setFiles((data as ArchivedFile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const filtered = files.filter(f => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (f.file_name ?? '').toLowerCase().includes(s) ||
      (f.file_id ?? '').toLowerCase().includes(s) ||
      (f.file_number ?? '').toLowerCase().includes(s) ||
      (f.archive_reason ?? '').toLowerCase().includes(s);
  });

  const pagedFiles = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

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
  }

  return (
    <Box>
      <PageHeader
        title="Archive History"
        subtitle={`${filtered.length} archived file${filtered.length !== 1 ? 's' : ''}`}
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        This is the permanent record of all files archived through the Shredder. Archived files are removed from all active lists but remain fully viewable here. Use Restore to return a file to active status. Nothing is ever deleted.
      </Alert>

      <Paper sx={{ mb: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <TextField
            placeholder="Search file name / number / reason..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            size="small" sx={{ minWidth: { xs: '100%', sm: 300 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          {search && (
            <Button startIcon={<ClearIcon />} onClick={() => setSearch('')} size="small" sx={{ alignSelf: 'center' }}>Clear</Button>
          )}
        </Stack>
      </Paper>

      <Paper>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1200 }}>
            <TableHead>
              <TableRow>
                <TableCell>File ID</TableCell>
                <TableCell>File Name</TableCell>
                <TableCell>File Number</TableCell>
                <TableCell>File Subject</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>AY</TableCell>
                <TableCell>FY</TableCell>
                <TableCell>Cabinet</TableCell>
                <TableCell>Retention Rule</TableCell>
                <TableCell>Archived Date</TableCell>
                <TableCell>Archived By</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={13} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : pagedFiles.length === 0 ? (
                <TableRow><TableCell colSpan={13} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No archived files found</Typography></TableCell></TableRow>
              ) : pagedFiles.map(f => (
                <TableRow key={f.id} hover sx={{ cursor: 'pointer' }} onClick={() => { setViewFileId(f.id); setViewOpen(true); }}>
                  <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{f.file_id}</Typography></TableCell>
                  <TableCell><Typography variant="body2" fontWeight={500}>{f.file_name}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.file_number || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.file_subject || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{(f.client as { client_name: string } | undefined)?.client_name ?? '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.assessment_year || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.financial_year || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{(f.cabinet as { cabinet_name: string } | undefined)?.cabinet_name ?? '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.retention_rule_name ?? '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.archived_at ? format(new Date(f.archived_at), 'dd MMM yyyy, HH:mm') : '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.archived_by_employee?.full_name ?? '-'}</Typography></TableCell>
                  <TableCell sx={{ maxWidth: 200 }}><Typography variant="caption" noWrap title={f.archive_reason ?? ''}>{f.archive_reason ?? '-'}</Typography></TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="View"><IconButton size="small" onClick={() => { setViewFileId(f.id); setViewOpen(true); }}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                    {canEdit && <Tooltip title="Restore"><IconButton size="small" color="success" onClick={() => setRestoreDialog({ open: true, file: f })}><RestoreIcon fontSize="small" /></IconButton></Tooltip>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      <FileViewDialog open={viewOpen} fileId={viewFileId} onClose={() => setViewOpen(false)} />

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
    </Box>
  );
}
