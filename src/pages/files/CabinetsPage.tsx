import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CabinetIcon from '@mui/icons-material/Weekend';
import { supabase } from '../../lib/supabase';
import type { Cabinet } from '../../types';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../lib/audit';

export default function CabinetsPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [cabinets, setCabinets] = useState<(Cabinet & { file_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCabinet, setEditCabinet] = useState<Cabinet | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; cabinet: Cabinet | null }>({ open: false, cabinet: null });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ cabinet_name: '', cabinet_number: '', num_shelves: '4', num_drawers: '0', capacity: '100', status: 'active' });

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  const loadCabinets = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('cabinets').select('*').eq('is_deleted', false).order('cabinet_name');
    const cabList = (data as Cabinet[]) ?? [];
    const withCounts = await Promise.all(cabList.map(async c => {
      const { count } = await supabase.from('physical_files').select('*', { count: 'exact', head: true }).eq('cabinet_id', c.id).eq('is_deleted', false);
      return { ...c, file_count: count ?? 0 };
    }));
    setCabinets(withCounts);
    setLoading(false);
  }, []);

  useEffect(() => { loadCabinets(); }, [loadCabinets]);

  function openEdit(cabinet: Cabinet | null) {
    setEditCabinet(cabinet);
    if (cabinet) {
      setForm({ cabinet_name: cabinet.cabinet_name, cabinet_number: cabinet.cabinet_number ?? '', num_shelves: String(cabinet.num_shelves), num_drawers: String(cabinet.num_drawers), capacity: String(cabinet.capacity), status: cabinet.status });
    } else {
      setForm({ cabinet_name: '', cabinet_number: '', num_shelves: '4', num_drawers: '0', capacity: '100', status: 'active' });
    }
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.cabinet_name.trim()) return;
    setSaving(true);
    const payload = { cabinet_name: form.cabinet_name, cabinet_number: form.cabinet_number, num_shelves: Number(form.num_shelves), num_drawers: Number(form.num_drawers), capacity: Number(form.capacity), status: form.status as Cabinet['status'] };
    if (editCabinet) {
      await supabase.from('cabinets').update(payload).eq('id', editCabinet.id);
      await logAudit({ action: 'UPDATE', module: 'cabinets', record_id: editCabinet.id, record_display: form.cabinet_name }, user?.id, profile?.full_name);
    } else {
      const { data } = await supabase.from('cabinets').insert({ ...payload, created_by: user?.id }).select().single();
      await logAudit({ action: 'CREATE', module: 'cabinets', record_id: (data as Cabinet)?.id, record_display: form.cabinet_name }, user?.id, profile?.full_name);
    }
    setSaving(false);
    setDialogOpen(false);
    loadCabinets();
  }

  async function handleDelete(reason?: string) {
    if (!deleteDialog.cabinet) return;
    await supabase.from('cabinets').update({ is_deleted: true }).eq('id', deleteDialog.cabinet.id);
    await logAudit({ action: 'DELETE', module: 'cabinets', record_id: deleteDialog.cabinet.id, record_display: deleteDialog.cabinet.cabinet_name, notes: reason }, user?.id, profile?.full_name);
    setDeleteDialog({ open: false, cabinet: null });
    loadCabinets();
  }

  return (
    <Box>
      <PageHeader
        title="Cabinets & Storage"
        subtitle="Manage physical storage locations"
        action={canEdit && <Button startIcon={<AddIcon />} variant="contained" onClick={() => openEdit(null)}>Add Cabinet</Button>}
      />

      {loading ? <CircularProgress /> : (
        <Grid container spacing={2}>
          {cabinets.length === 0 && (
            <Grid size={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <CabinetIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">No cabinets yet. Add one to start managing storage.</Typography>
              </Paper>
            </Grid>
          )}
          {cabinets.map(cabinet => {
            const occupancy = cabinet.capacity > 0 ? Math.min((cabinet.file_count ?? 0) / cabinet.capacity * 100, 100) : 0;
            const occColor = occupancy > 90 ? 'error' : occupancy > 70 ? 'warning' : 'primary';
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={cabinet.id}>
                <Card sx={{
                  cursor: 'pointer',
                  borderRadius: 3,
                  overflow: 'hidden',
                  transition: 'all 0.25s ease-in-out',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { boxShadow: 6, transform: 'translateY(-2px)', borderColor: 'primary.main' },
                }} onClick={() => navigate(`/cabinets/${cabinet.id}`)}>
                  <Box sx={{ height: 6, bgcolor: occupancy > 90 ? 'error.main' : occupancy > 70 ? 'warning.main' : 'primary.main' }} />
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'primary.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CabinetIcon sx={{ color: 'white', fontSize: 22 }} />
                        </Box>
                        <Box>
                          <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>{cabinet.cabinet_name}</Typography>
                          {cabinet.cabinet_number && <Typography variant="caption" color="text.secondary">#{cabinet.cabinet_number}</Typography>}
                        </Box>
                      </Box>
                      <StatusChip status={cabinet.status} />
                    </Box>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                      <Chip label={`${cabinet.num_shelves} shelves`} size="small" variant="outlined" />
                      {cabinet.num_drawers > 0 && <Chip label={`${cabinet.num_drawers} drawers`} size="small" variant="outlined" />}
                      <Chip label={`${cabinet.file_count ?? 0}/${cabinet.capacity} files`} size="small" color={occupancy > 90 ? 'error' : occupancy > 70 ? 'warning' : 'success'} variant="outlined" />
                    </Stack>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Occupancy</Typography>
                      <Typography variant="caption" fontWeight={700} color={occupancy > 90 ? 'error.main' : occupancy > 70 ? 'warning.main' : 'primary.main'}>{Math.round(occupancy)}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={occupancy} color={occColor as 'primary' | 'warning' | 'error'} sx={{ height: 8, borderRadius: 4 }} />
                  </CardContent>
                  {canEdit && (
                    <CardActions onClick={(e) => e.stopPropagation()} sx={{ px: 2.5, pb: 2 }}>
                      <IconButton size="small" onClick={() => openEdit(cabinet)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, cabinet })}><DeleteIcon fontSize="small" /></IconButton>
                    </CardActions>
                  )}
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editCabinet ? 'Edit Cabinet' : 'Add Cabinet'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField label="Cabinet Name *" value={form.cabinet_name} onChange={e => setForm(p => ({ ...p, cabinet_name: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Cabinet Number" value={form.cabinet_number} onChange={e => setForm(p => ({ ...p, cabinet_number: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid size={4}>
              <TextField label="Shelves" type="number" value={form.num_shelves} onChange={e => setForm(p => ({ ...p, num_shelves: e.target.value }))} fullWidth size="small" inputProps={{ min: 0 }} />
            </Grid>
            <Grid size={4}>
              <TextField label="Drawers" type="number" value={form.num_drawers} onChange={e => setForm(p => ({ ...p, num_drawers: e.target.value }))} fullWidth size="small" inputProps={{ min: 0 }} />
            </Grid>
            <Grid size={4}>
              <TextField label="Capacity" type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} fullWidth size="small" inputProps={{ min: 1 }} />
            </Grid>
            <Grid size={12}>
              <TextField select label="Status" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} fullWidth size="small">
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="full">Full</MenuItem>
                <MenuItem value="under_maintenance">Under Maintenance</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving || !form.cabinet_name.trim()}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {editCabinet ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Cabinet"
        message={`Delete cabinet "${deleteDialog.cabinet?.cabinet_name}"? Files in this cabinet will remain, but lose their location.`}
        requireReason
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, cabinet: null })}
      />
    </Box>
  );
}
