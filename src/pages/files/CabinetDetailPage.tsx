import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Tooltip from '@mui/material/Tooltip';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import PdfExportDialog, { type PdfColumn, type PdfRow } from '../../components/common/PdfExportDialog';
import { supabase } from '../../lib/supabase';
import type { Cabinet, PhysicalFile, Client, Employee } from '../../types';
import StatusChip from '../../components/common/StatusChip';
import FileViewDialog from '../../components/files/FileViewDialog';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const STATUS_OPTIONS = ['all', 'available', 'in_use', 'sent_outside', 'archived', 'missing', 'disposed'];

export default function CabinetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { profile } = useAuth();
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  const [cabinet, setCabinet] = useState<Cabinet | null>(null);
  const [files, setFiles] = useState<PhysicalFile[]>([]);
  const [total, setTotal] = useState(0);
  const [cabinetFileCount, setCabinetFileCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [ayFilter, setAyFilter] = useState('');
  const [fyFilter, setFyFilter] = useState('');
  const [holderFilter, setHolderFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewFileId, setViewFileId] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [cabRes, filesRes, countRes] = await Promise.all([
      supabase.from('cabinets').select('*').eq('id', id).maybeSingle(),
      supabase.from('physical_files')
        .select('*, client:clients(client_name,client_id), current_holder:employees(full_name)', { count: 'exact' })
        .eq('cabinet_id', id)
        .eq('is_deleted', false)
        .neq('status', 'archived')
        .order('file_name')
        .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1),
      supabase.from('physical_files')
        .select('id', { count: 'exact', head: true })
        .eq('cabinet_id', id)
        .eq('is_deleted', false)
        .neq('status', 'archived'),
    ]);
    setCabinet(cabRes.data as Cabinet | null);
    let filtered = (filesRes.data as PhysicalFile[]) ?? [];
    if (statusFilter !== 'all') filtered = filtered.filter(f => f.status === statusFilter);
    if (clientFilter !== 'all') filtered = filtered.filter(f => f.client_id === clientFilter);
    if (ayFilter) { const s = ayFilter.toLowerCase(); filtered = filtered.filter(f => (f.assessment_year ?? '').toLowerCase().includes(s)); }
    if (fyFilter) { const s = fyFilter.toLowerCase(); filtered = filtered.filter(f => (f.financial_year ?? '').toLowerCase().includes(s)); }
    if (holderFilter !== 'all') filtered = filtered.filter(f => f.current_holder_id === holderFilter);
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(f =>
        (f.file_name ?? '').toLowerCase().includes(s) ||
        (f.file_id ?? '').toLowerCase().includes(s) ||
        (f.file_number ?? '').toLowerCase().includes(s)
      );
    }
    if (subjectSearch) {
      const s = subjectSearch.toLowerCase();
      filtered = filtered.filter(f => (f.file_subject ?? '').toLowerCase().includes(s));
    }
    setFiles(filtered);
    setTotal(filesRes.count ?? 0);
    setCabinetFileCount(countRes.count ?? 0);
    setLoading(false);
  }, [id, page, rowsPerPage, statusFilter, search, subjectSearch, clientFilter, ayFilter, fyFilter, holderFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    supabase.from('clients').select('id, client_name, client_id').eq('is_deleted', false).eq('status', 'active').order('client_name').then(r => setClients((r.data ?? []) as Client[]));
    supabase.from('employees').select('*').eq('status', 'active').order('full_name').then(r => setEmployees(r.data ?? []));
  }, []);

  function handleExport() {
    const rows = files.map(f => ({
      'File ID': f.file_id,
      'File Name': f.file_name,
      'File Number': f.file_number ?? '',
      'File Subject': f.file_subject ?? '',
      'Client': (f.client as { client_name: string } | undefined)?.client_name ?? '',
      'AY': f.assessment_year ?? '',
      'FY': f.financial_year ?? '',
      'Shelf': f.shelf ?? '',
      'Rack': f.rack ?? '',
      'Status': f.status,
      'Last Movement': f.last_movement_date ? format(new Date(f.last_movement_date), 'dd MMM yyyy') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Files');
    XLSX.writeFile(wb, `cabinet_${cabinet?.cabinet_name ?? 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function clearFilters() {
    setSearch('');
    setSubjectSearch('');
    setStatusFilter('all');
    setClientFilter('all');
    setAyFilter('');
    setFyFilter('');
    setHolderFilter('all');
    setPage(0);
  }

  const hasActiveFilters = search || subjectSearch || statusFilter !== 'all' || clientFilter !== 'all' || ayFilter || fyFilter || holderFilter !== 'all';

  if (loading && !cabinet) {
    return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>;
  }

  if (!cabinet) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/cabinets')}>Back to Cabinets</Button>
        <Paper sx={{ p: 4, textAlign: 'center', mt: 2 }}>
          <Typography color="text.secondary">Cabinet not found.</Typography>
        </Paper>
      </Box>
    );
  }

  const occupancy = cabinet.capacity > 0 ? Math.min(cabinetFileCount / cabinet.capacity * 100, 100) : 0;

  return (
    <Box sx={{ pb: { xs: 10, md: 0 } }}>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link href="#" onClick={(e) => { e.preventDefault(); navigate('/files'); }}>Physical Files</Link>
        <Link href="#" onClick={(e) => { e.preventDefault(); navigate('/cabinets'); }}>Cabinets</Link>
        <Typography color="text.primary">{cabinet.cabinet_name}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/cabinets')} size="small"><ArrowBackIcon /></IconButton>
        <Typography variant="h5" fontWeight={700} color="primary.main" sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
          {cabinet.cabinet_name}
        </Typography>
        {cabinet.cabinet_number && <Chip label={`#${cabinet.cabinet_number}`} size="small" />}
        <StatusChip status={cabinet.status} />
      </Box>

      <Paper sx={{ mb: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="caption" color="text.secondary">Occupancy ({cabinetFileCount}/{cabinet.capacity})</Typography>
            <LinearProgress
              variant="determinate"
              value={occupancy}
              color={occupancy > 90 ? 'error' : occupancy > 70 ? 'warning' : 'primary'}
              sx={{ mt: 0.5 }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`${cabinet.num_shelves} shelves`} size="small" />
          </Box>
          <Button startIcon={<FileDownloadIcon />} variant="outlined" size="small" onClick={handleExport}>
            Export
          </Button>
          <Button variant="outlined" size="small" onClick={() => setPdfOpen(true)}>
            Export PDF
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ mb: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <TextField
            placeholder="Search file name, ID, number..."
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
          <TextField select value={clientFilter} onChange={e => { setClientFilter(e.target.value); setPage(0); }} size="small" label="Client" sx={{ minWidth: 140 }}>
            <MenuItem value="all">All Clients</MenuItem>
            {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.client_name}</MenuItem>)}
          </TextField>
          <TextField placeholder="Filter AY..." value={ayFilter} onChange={e => { setAyFilter(e.target.value); setPage(0); }} size="small" label="AY" sx={{ minWidth: 110 }} />
          <TextField placeholder="Filter FY..." value={fyFilter} onChange={e => { setFyFilter(e.target.value); setPage(0); }} size="small" label="FY" sx={{ minWidth: 110 }} />
          <TextField select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} size="small" label="Status" sx={{ minWidth: 130 }}>
            {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s === 'all' ? 'All Status' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</MenuItem>)}
          </TextField>
          <TextField select value={holderFilter} onChange={e => { setHolderFilter(e.target.value); setPage(0); }} size="small" label="Holder" sx={{ minWidth: 140 }}>
            <MenuItem value="all">All Holders</MenuItem>
            {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
          </TextField>
          {hasActiveFilters && (
            <Button onClick={clearFilters} size="small" sx={{ alignSelf: 'center', whiteSpace: 'nowrap' }}>Clear Filters</Button>
          )}
        </Stack>
      </Paper>

      {hasActiveFilters && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Showing {files.length} matching file{files.length !== 1 ? 's' : ''} in this cabinet
        </Typography>
      )}

      {isMobile ? (
        <Box>
          {loading ? <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
            : files.length === 0 ? <Paper sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No files in this cabinet</Typography></Paper>
            : files.map(f => (
              <Card key={f.id} sx={{ mb: 1.5, cursor: 'pointer' }} onClick={() => { setViewFileId(f.id); setViewOpen(true); }}>
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant="caption" color="primary.main" fontWeight={700}>{f.file_id}</Typography>
                    <StatusChip status={f.status} />
                  </Box>
                  <Typography variant="subtitle2" fontWeight={600}>{f.file_name}</Typography>
                  {f.file_subject && <Typography variant="caption" color="text.secondary" display="block">{f.file_subject}</Typography>}
                  <Typography variant="caption" color="text.secondary" display="block">
                    {(f.client as { client_name: string } | undefined)?.client_name ?? '-'}
                    {f.assessment_year ? ` · AY ${f.assessment_year}` : ''}
                    {f.financial_year ? ` · FY ${f.financial_year}` : ''}
                  </Typography>
                  {f.shelf && <Typography variant="caption" color="text.secondary">Shelf {f.shelf}</Typography>}
                </CardContent>
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
            <Table size="small" sx={{ minWidth: 1100 }}>
              <TableHead>
                <TableRow>
                  <TableCell>File ID</TableCell>
                  <TableCell>File Name</TableCell>
                  <TableCell>File Number</TableCell>
                  <TableCell>File Subject</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>AY</TableCell>
                  <TableCell>FY</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Shelf</TableCell>
                  <TableCell>Current Holder</TableCell>
                  <TableCell>Last Moved</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={12} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
                  : files.length === 0 ? <TableRow><TableCell colSpan={12} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No files in this cabinet</Typography></TableCell></TableRow>
                  : files.map(f => (
                    <TableRow key={f.id} hover sx={{ cursor: 'pointer' }} onClick={() => { setViewFileId(f.id); setViewOpen(true); }}>
                      <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{f.file_id}</Typography></TableCell>
                      <TableCell><Typography variant="body2" fontWeight={500}>{f.file_name}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{f.file_number || '-'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{f.file_subject || '-'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{(f.client as { client_name: string } | undefined)?.client_name ?? '-'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{f.assessment_year || '-'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{f.financial_year || '-'}</Typography></TableCell>
                      <TableCell><StatusChip status={f.status} /></TableCell>
                      <TableCell><Typography variant="body2">{f.shelf || '-'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{(f.current_holder as { full_name: string } | undefined)?.full_name ?? '-'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{f.last_movement_date ? format(new Date(f.last_movement_date), 'dd MMM yy') : '-'}</Typography></TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="View"><IconButton size="small" onClick={() => { setViewFileId(f.id); setViewOpen(true); }}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                        {canEdit && <Tooltip title="Edit"><IconButton size="small" onClick={() => navigate(`/files/${f.id}`)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Box>
          <TablePagination
            component="div" count={total} page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Paper>
      )}

      <FileViewDialog open={viewOpen} fileId={viewFileId} onClose={() => setViewOpen(false)} />

      <PdfExportDialog
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        title={`Cabinet: ${cabinet.cabinet_name}`}
        columns={[
          { key: 'file_id', label: 'File ID' },
          { key: 'file_name', label: 'File Name' },
          { key: 'file_number', label: 'File Number' },
          { key: 'file_subject', label: 'Subject' },
          { key: 'client_name', label: 'Client' },
          { key: 'assessment_year', label: 'AY' },
          { key: 'financial_year', label: 'FY' },
          { key: 'status', label: 'Status' },
          { key: 'shelf', label: 'Shelf' },
          { key: 'holder', label: 'Holder' },
        ] as PdfColumn[]}
        rows={files.map(f => ({
          file_id: f.file_id,
          file_name: f.file_name,
          file_number: f.file_number || '-',
          file_subject: f.file_subject || '-',
          client_name: (f.client as { client_name: string } | undefined)?.client_name ?? '-',
          assessment_year: f.assessment_year || '-',
          financial_year: f.financial_year || '-',
          status: f.status.replace(/_/g, ' '),
          shelf: f.shelf || '-',
          holder: (f.current_holder as { full_name: string } | undefined)?.full_name ?? '-',
        })) as PdfRow[]}
        filtersDescription={hasActiveFilters ? 'Active filters applied' : undefined}
      />
    </Box>
  );
}
