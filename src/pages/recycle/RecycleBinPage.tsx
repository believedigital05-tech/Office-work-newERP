import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import RestoreIcon from '@mui/icons-material/Restore';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/common/PageHeader';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../lib/audit';
import { format } from 'date-fns';

const MODULES = ['all', 'clients', 'physical_files', 'file_movements', 'couriers', 'activities'];

export default function RecycleBinPage() {
  const { profile, user } = useAuth();
  const [module, setModule] = useState('all');
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [restoreDialog, setRestoreDialog] = useState<{ open: boolean; item: Record<string, unknown> | null; mod: string }>({ open: false, item: null, mod: '' });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => { loadDeleted(); }, [module]);

  async function loadDeleted() {
    setLoading(true);
    const fetchModule = async (mod: string, table: string) => {
      const { data } = await supabase.from(table).select('*').eq('is_deleted', true).order('deleted_at', { ascending: false }).limit(50);
      return (data ?? []).map(r => ({ ...r, _module: mod, _table: table }));
    };
    const mods: [string, string][] = [
      ['clients', 'clients'], ['files', 'physical_files'],
      ['movements', 'file_movements'], ['couriers', 'couriers'], ['activities', 'activities'],
    ];
    let results: Array<Record<string, unknown>> = [];
    if (module === 'all') {
      const all = await Promise.all(mods.map(([m, t]) => fetchModule(m, t)));
      results = all.flat();
    } else {
      const found = mods.find(([m, t]) => m === module || t === module);
      if (found) results = await fetchModule(found[0], found[1]);
    }
    results.sort((a, b) => new Date(b.deleted_at as string ?? 0).getTime() - new Date(a.deleted_at as string ?? 0).getTime());
    setItems(results);
    setLoading(false);
  }

  async function handleRestore() {
    const { item, mod: _m } = restoreDialog;
    if (!item) return;
    const table = item._table as string;
    await supabase.from(table).update({ is_deleted: false, deleted_at: null, deleted_by: null, delete_reason: null }).eq('id', item.id);
    await logAudit({ action: 'RESTORE', module: item._module as string, record_id: item.id as string, record_display: getDisplayName(item) }, user?.id, profile?.full_name);
    setRestoreDialog({ open: false, item: null, mod: '' });
    loadDeleted();
  }

  function getDisplayName(item: Record<string, unknown>) {
    return (item.client_name ?? item.file_name ?? item.movement_id ?? item.courier_id ?? item.title ?? item.id) as string;
  }

  return (
    <Box>
      <PageHeader title="Recycle Bin" subtitle="Restore accidentally deleted records" />

      {!isAdmin && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">Only administrators can access the Recycle Bin.</Typography>
        </Paper>
      )}

      {isAdmin && (
        <>
          <Paper sx={{ mb: 2, p: 2 }}>
            <TextField select value={module} onChange={e => setModule(e.target.value)} size="small" label="Module" sx={{ width: 200 }}>
              {MODULES.map(m => <MenuItem key={m} value={m}>{m === 'all' ? 'All Modules' : m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</MenuItem>)}
            </TextField>
          </Paper>

          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Module</TableCell>
                  <TableCell>Record</TableCell>
                  <TableCell>Delete Reason</TableCell>
                  <TableCell>Deleted At</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
                  : items.length === 0 ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><Typography color="text.secondary">Recycle bin is empty</Typography></TableCell></TableRow>
                  : items.map(item => (
                    <TableRow key={`${item._table}-${item.id}`} hover>
                      <TableCell>
                        <Typography variant="caption" sx={{ textTransform: 'capitalize', bgcolor: 'primary.50', px: 1, py: 0.25, borderRadius: 1 }}>
                          {(item._module as string).replace(/_/g, ' ')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{getDisplayName(item)}</Typography>
                      </TableCell>
                      <TableCell>{item.delete_reason as string ?? '-'}</TableCell>
                      <TableCell>{item.deleted_at ? format(new Date(item.deleted_at as string), 'dd MMM yyyy HH:mm') : '-'}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Restore">
                          <IconButton size="small" color="primary" onClick={() => setRestoreDialog({ open: true, item, mod: item._module as string })}>
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Paper>

          <ConfirmDialog
            open={restoreDialog.open}
            title="Restore Record"
            message={`Restore "${restoreDialog.item ? getDisplayName(restoreDialog.item) : ''}" from the recycle bin?`}
            confirmLabel="Restore"
            confirmColor="primary"
            onConfirm={handleRestore}
            onCancel={() => setRestoreDialog({ open: false, item: null, mod: '' })}
          />
        </>
      )}
    </Box>
  );
}
