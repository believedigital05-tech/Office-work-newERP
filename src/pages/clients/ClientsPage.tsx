import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import VisibilityIcon from '@mui/icons-material/Visibility';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';

import { supabase } from '../../lib/supabase';
import type { Client } from '../../types';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ClientDialog from './ClientDialog';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../lib/audit';
import * as XLSX from 'xlsx';

const STATUS_OPTIONS = ['all', 'active', 'inactive', 'onboarding', 'exited'];

export default function ClientsPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; client: Client | null }>({ open: false, client: null });

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';
  const canDelete = profile?.role === 'admin';
  const canSeeSensitive = profile?.role === 'admin' || profile?.role === 'manager';

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('clients')
        .select('*, client_type:client_types(name), assigned_employee:employees(full_name)', { count: 'exact' })
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (search) {
        query = query.or(`client_name.ilike.%${search}%,client_id.ilike.%${search}%,pan_number.ilike.%${search}%,mobile_number.ilike.%${search}%,email.ilike.%${search}%`);
      }
      const { data, count } = await query;
      setClients((data as Client[]) ?? []);
      setTotal(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, statusFilter]);

  useEffect(() => { loadClients(); }, [loadClients]);

  async function handleDelete(reason?: string) {
    if (!deleteDialog.client) return;
    await supabase.from('clients').update({
      is_deleted: true, deleted_at: new Date().toISOString(),
      deleted_by: user?.id, delete_reason: reason,
    }).eq('id', deleteDialog.client.id);
    await logAudit({ action: 'DELETE', module: 'clients', record_id: deleteDialog.client.id, record_display: deleteDialog.client.client_name, notes: reason }, user?.id, profile?.full_name);
    setDeleteDialog({ open: false, client: null });
    loadClients();
  }

  function handleExport() {
    const rows = clients.map(c => ({
      'Client ID': c.client_id,
      'Client Name': c.client_name,
      'Type': (c.client_type as { name: string } | undefined)?.name ?? '',
      'Contact Person': c.contact_person ?? '',
      'Mobile': c.mobile_number ?? '',
      'Email': c.email ?? '',
      'Status': c.status,
      'PAN': canSeeSensitive ? (c.pan_number ?? '') : '***',
      'GST': canSeeSensitive ? (c.gst_number ?? '') : '***',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, `clients_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function openAdd() { setEditClient(null); setDialogOpen(true); }
  function openEdit(client: Client) { setEditClient(client); setDialogOpen(true); }

  return (
    <Box sx={{ pb: { xs: 10, md: 0 } }}>
      <PageHeader
        title="Client Master"
        subtitle={`${total} clients`}
        action={
          !isMobile ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button startIcon={<FileDownloadIcon />} variant="outlined" size="small" onClick={handleExport}>Export</Button>
              {canEdit && <Button startIcon={<AddIcon />} variant="contained" onClick={openAdd}>Add Client</Button>}
            </Box>
          ) : (
            <Button startIcon={<FileDownloadIcon />} variant="outlined" size="small" onClick={handleExport}>Export</Button>
          )
        }
      />

      <Paper sx={{ mb: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <TextField
            placeholder="Search name, ID, PAN, mobile..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            size="small"
            fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          <TextField
            select value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            size="small" label="Status"
            sx={{ minWidth: 130 }}
          >
            {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
          </TextField>
        </Stack>
      </Paper>

      {/* Mobile card view */}
      {isMobile ? (
        <Box>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
          ) : clients.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No clients found</Typography>
            </Paper>
          ) : clients.map(client => (
            <Card key={client.id} sx={{ mb: 1.5 }}>
              <CardContent sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                  <Typography variant="caption" color="primary.main" fontWeight={700}>{client.client_id}</Typography>
                  <StatusChip status={client.status} />
                </Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }} onClick={() => navigate(`/clients/${client.id}`)}>{client.client_name}</Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {(client.client_type as { name: string } | undefined)?.name ?? ''}
                </Typography>
                {client.mobile_number && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <PhoneIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                    <Typography variant="caption">{client.mobile_number}</Typography>
                  </Box>
                )}
                {client.email && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <EmailIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                    <Typography variant="caption">{client.email}</Typography>
                  </Box>
                )}
              </CardContent>
              <CardActions sx={{ pt: 0, px: 2, pb: 1 }}>
                <IconButton size="small" onClick={() => navigate(`/clients/${client.id}`)} color="primary"><VisibilityIcon fontSize="small" /></IconButton>
                {canEdit && <IconButton size="small" onClick={() => openEdit(client)}><EditIcon fontSize="small" /></IconButton>}
                {canDelete && <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, client })}><DeleteIcon fontSize="small" /></IconButton>}
              </CardActions>
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
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Client ID</TableCell>
                  <TableCell>Client Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>PAN</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Assigned To</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
                ) : clients.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No clients found</Typography></TableCell></TableRow>
                ) : clients.map((client) => (
                  <TableRow key={client.id} hover>
                    <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{client.client_id}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} component="span" sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }} onClick={() => navigate(`/clients/${client.id}`)}>{client.client_name}</Typography>
                      {client.email && <Typography variant="caption" color="text.secondary" display="block">{client.email}</Typography>}
                    </TableCell>
                    <TableCell><Typography variant="body2">{(client.client_type as { name: string } | undefined)?.name ?? '-'}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2">{client.contact_person ?? '-'}</Typography>
                      {client.mobile_number && <Typography variant="caption" color="text.secondary">{client.mobile_number}</Typography>}
                    </TableCell>
                    <TableCell>
                      {canSeeSensitive ? (
                        <Typography variant="body2">{client.pan_number ?? '-'}</Typography>
                      ) : (
                        <Chip label="Masked" size="small" />
                      )}
                    </TableCell>
                    <TableCell><StatusChip status={client.status} /></TableCell>
                    <TableCell><Typography variant="body2">{(client.assigned_employee as { full_name: string } | undefined)?.full_name ?? '-'}</Typography></TableCell>
                    <TableCell align="right">
                      <Tooltip title="View"><IconButton size="small" onClick={() => navigate(`/clients/${client.id}`)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                      {canEdit && <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(client)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                      {canDelete && <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, client })}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
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

      {/* FAB for mobile */}
      {isMobile && canEdit && (
        <Fab color="primary" onClick={openAdd} sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1200 }}>
          <AddIcon />
        </Fab>
      )}

      <ClientDialog
        open={dialogOpen}
        client={editClient}
        onClose={() => setDialogOpen(false)}
        onSaved={loadClients}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Client"
        message={`Are you sure you want to delete "${deleteDialog.client?.client_name}"? It will be moved to the Recycle Bin.`}
        requireReason
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, client: null })}
      />
    </Box>
  );
}
