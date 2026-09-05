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
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import FileViewDialog from '../../components/files/FileViewDialog';
import { supabase } from '../../lib/supabase';
import type { PhysicalFile, FileMovement } from '../../types';
import { format } from 'date-fns';

interface DisposedFile extends PhysicalFile {
  disposed_by_employee?: { full_name: string } | null;
  movements?: FileMovement[];
}

export default function DisposedFilesPage() {
  const [files, setFiles] = useState<DisposedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [movements, setMovements] = useState<Record<string, FileMovement[]>>({});
  const [viewOpen, setViewOpen] = useState(false);
  const [viewFileId, setViewFileId] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('physical_files')
      .select('*, client:clients(client_name,client_id), cabinet:cabinets(cabinet_name), disposed_by_employee:employees!physical_files_disposed_by_fkey(full_name)')
      .eq('is_deleted', false)
      .eq('status', 'disposed')
      .order('disposed_at', { ascending: false });
    setFiles((data as DisposedFile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  async function toggleExpand(fileId: string) {
    if (expandedRow === fileId) {
      setExpandedRow(null);
      return;
    }
    setExpandedRow(fileId);
    if (!movements[fileId]) {
      const { data } = await supabase.from('file_movements')
        .select('*, taken_by:employees!file_movements_taken_by_id_fkey(full_name), received_by:employees!file_movements_received_by_id_fkey(full_name)')
        .eq('file_id', fileId)
        .order('created_at', { ascending: false });
      setMovements(prev => ({ ...prev, [fileId]: (data as FileMovement[]) ?? [] }));
    }
  }

  const filtered = files.filter(f => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (f.file_name ?? '').toLowerCase().includes(s) ||
      (f.file_id ?? '').toLowerCase().includes(s) ||
      (f.file_number ?? '').toLowerCase().includes(s) ||
      (f.dispose_reason ?? '').toLowerCase().includes(s);
  });

  const pagedFiles = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <Box>
      <PageHeader
        title="Disposed Files History"
        subtitle={`${filtered.length} disposed file${filtered.length !== 1 ? 's' : ''}`}
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        This is a permanent audit trail of all disposed files. Records here cannot be deleted or modified. Click a row to view the file's movement history before disposal.
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
          <Table size="small" sx={{ minWidth: 1100 }}>
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>File ID</TableCell>
                <TableCell>File Name</TableCell>
                <TableCell>File Number</TableCell>
                <TableCell>AY</TableCell>
                <TableCell>FY</TableCell>
                <TableCell>Cabinet</TableCell>
                <TableCell>Disposed Date</TableCell>
                <TableCell>Disposed By</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : pagedFiles.length === 0 ? (
                <TableRow><TableCell colSpan={11} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No disposed files found</Typography></TableCell></TableRow>
              ) : pagedFiles.map(f => (
                <>
                  <TableRow key={f.id} hover sx={{ cursor: 'pointer' }} onClick={() => { setViewFileId(f.id); setViewOpen(true); }}>
                    <TableCell padding="checkbox" onClick={(e) => { e.stopPropagation(); toggleExpand(f.id); }}>
                      <IconButton size="small">
                        <ExpandMoreIcon sx={{ transform: expandedRow === f.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </IconButton>
                    </TableCell>
                    <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{f.file_id}</Typography></TableCell>
                    <TableCell><Typography variant="body2" fontWeight={500}>{f.file_name}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{f.file_number || '-'}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{f.assessment_year || '-'}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{f.financial_year || '-'}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{(f.cabinet as { cabinet_name: string } | undefined)?.cabinet_name ?? '-'}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{f.disposed_at ? format(new Date(f.disposed_at), 'dd MMM yyyy, HH:mm') : '-'}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{f.disposed_by_employee?.full_name ?? '-'}</Typography></TableCell>
                    <TableCell sx={{ maxWidth: 200 }}><Typography variant="caption" noWrap title={f.dispose_reason ?? ''}>{f.dispose_reason ?? '-'}</Typography></TableCell>
                    <TableCell><StatusChip status={f.status} /></TableCell>
                  </TableRow>
                  <TableRow key={`${f.id}-detail`}>
                    <TableCell colSpan={11} sx={{ py: 0, border: 0 }}>
                      <Collapse in={expandedRow === f.id} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 2 }}>
                          <Typography variant="overline" color="text.secondary">Movement History Before Disposal</Typography>
                          {movements[f.id] === undefined ? (
                            <Box sx={{ py: 1 }}><CircularProgress size={20} /></Box>
                          ) : movements[f.id].length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No movement records for this file.</Typography>
                          ) : (
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Movement ID</TableCell>
                                  <TableCell>Taken By</TableCell>
                                  <TableCell>Purpose</TableCell>
                                  <TableCell>Taken Date</TableCell>
                                  <TableCell>Return Date</TableCell>
                                  <TableCell>Remarks</TableCell>
                                  <TableCell>Status</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {movements[f.id].map(m => (
                                  <TableRow key={m.id}>
                                    <TableCell>{m.movement_id}</TableCell>
                                    <TableCell>{(m.taken_by as { full_name: string } | undefined)?.full_name ?? '-'}</TableCell>
                                    <TableCell>{m.purpose ?? '-'}</TableCell>
                                    <TableCell>{m.taken_date ? format(new Date(m.taken_date), 'dd MMM yyyy') : '-'}</TableCell>
                                    <TableCell>{m.returned_date ? format(new Date(m.returned_date), 'dd MMM yyyy') : '-'}</TableCell>
                                    <TableCell sx={{ maxWidth: 200 }}><Typography variant="caption" noWrap title={m.remarks ?? ''}>{m.remarks ?? '-'}</Typography></TableCell>
                                    <TableCell><StatusChip status={m.status} /></TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </>
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
    </Box>
  );
}
