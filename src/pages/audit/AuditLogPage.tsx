import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import SearchIcon from '@mui/icons-material/Search';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/common/PageHeader';
import { format } from 'date-fns';

const MODULES = ['all', 'clients', 'physical_files', 'file_movements', 'couriers', 'activities', 'cabinets'];
const ACTIONS = ['all', 'CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'IMPORT', 'EXPORT', 'RETURN', 'COMPLETE'];

const actionColors: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  CREATE: 'success', UPDATE: 'info', DELETE: 'error', RESTORE: 'warning',
  IMPORT: 'info', EXPORT: 'info', RETURN: 'success', COMPLETE: 'success',
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => { loadLogs(); }, [page, rowsPerPage, search, moduleFilter, actionFilter]);

  async function loadLogs() {
    setLoading(true);
    let query = supabase.from('audit_logs').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);
    if (moduleFilter !== 'all') query = query.eq('module', moduleFilter);
    if (actionFilter !== 'all') query = query.eq('action', actionFilter);
    if (search) query = query.or(`user_name.ilike.%${search}%,record_display.ilike.%${search}%,notes.ilike.%${search}%`);
    const { data, count } = await query;
    setLogs(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }

  return (
    <Box>
      <PageHeader title="Audit Log" subtitle="Permanent record of all system actions" />

      <Paper sx={{ mb: 2, p: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search user, record, notes..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          size="small" sx={{ width: { xs: '100%', sm: 260 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        />
        <TextField select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(0); }} size="small" label="Module" sx={{ width: 160 }}>
          {MODULES.map(m => <MenuItem key={m} value={m}>{m === 'all' ? 'All Modules' : m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</MenuItem>)}
        </TextField>
        <TextField select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0); }} size="small" label="Action" sx={{ width: 140 }}>
          {ACTIONS.map(a => <MenuItem key={a} value={a}>{a === 'all' ? 'All Actions' : a}</MenuItem>)}
        </TextField>
      </Paper>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date / Time</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Module</TableCell>
              <TableCell>Record</TableCell>
              <TableCell>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              : logs.length === 0 ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No audit logs found</Typography></TableCell></TableRow>
              : logs.map(log => (
                <TableRow key={log.id as string} hover>
                  <TableCell><Typography variant="caption">{format(new Date(log.created_at as string), 'dd MMM yyyy HH:mm')}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{log.user_name as string ?? '-'}</Typography></TableCell>
                  <TableCell><Chip label={log.action as string} size="small" color={actionColors[log.action as string] ?? 'default'} /></TableCell>
                  <TableCell><Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{(log.module as string)?.replace(/_/g, ' ')}</Typography></TableCell>
                  <TableCell><Typography variant="body2" fontWeight={500}>{log.record_display as string ?? log.record_id as string ?? '-'}</Typography></TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{log.notes as string ?? '-'}</Typography></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>
    </Box>
  );
}
