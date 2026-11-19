import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import MinimizeIcon from '@mui/icons-material/Minimize';
import FolderIcon from '@mui/icons-material/Folder';
import { supabase } from '../../lib/supabase';
import type { Client, Cabinet, Employee, PhysicalFile } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useMinimize } from '../../contexts/MinimizeContext';
import { useYear } from '../../contexts/YearContext';
import { logAudit } from '../../lib/audit';
import { getNextYearLabel } from '../../lib/yearUtils';
import ConfirmDialog from '../common/ConfirmDialog';

export const FILE_STATUS_OPTIONS = ['available', 'in_use', 'sent_outside', 'archived', 'missing', 'disposed'];

const EMPTY_FORM = {
  file_number: '', file_name: '', file_subject: '', client_id: '',
  assessment_year: '', financial_year: '',
  cabinet_id: '', shelf: '', rack: '',
  current_holder_id: '', status: 'available', remarks: '',
};

interface FileDialogProps {
  open: boolean;
  file: PhysicalFile | null;
  onClose: () => void;
  onSaved: () => void;
}

const WINDOW_ID = 'file-edit-form';

export default function FileDialog({ open, file, onClose, onSaved }: FileDialogProps) {
  const { user, profile } = useAuth();
  const { minimize, remove } = useMinimize();
  const { assessmentYears, financialYears, selectedAY, selectedFY } = useYear();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [initial, setInitial] = useState(JSON.stringify(EMPTY_FORM));

  useEffect(() => {
    supabase.from('cabinets').select('*').eq('is_deleted', false).order('cabinet_name').then(r => setCabinets(r.data ?? []));
    supabase.from('clients').select('id, client_name, client_id').eq('is_deleted', false).eq('status', 'active').order('client_name').then(r => setClients((r.data ?? []) as Client[]));
    supabase.from('employees').select('*').eq('status', 'active').order('full_name').then(r => setEmployees(r.data ?? []));
  }, []);

  useEffect(() => {
    if (!open) return;
    setError('');
    setMinimized(false);
    remove(WINDOW_ID);
    if (file) {
      const filled = {
        file_number: file.file_number ?? '', file_name: file.file_name ?? '', file_subject: file.file_subject ?? '',
        client_id: file.client_id ?? '', assessment_year: file.assessment_year ?? '', financial_year: file.financial_year ?? '',
        cabinet_id: file.cabinet_id ?? '', shelf: file.shelf ?? '', rack: file.rack ?? '',
        current_holder_id: file.current_holder_id ?? '', status: file.status, remarks: file.remarks ?? '',
      };
      setForm(filled);
      setInitial(JSON.stringify(filled));
    } else {
      const fresh = { ...EMPTY_FORM, assessment_year: selectedAY, financial_year: selectedFY };
      setForm(fresh);
      setInitial(JSON.stringify(fresh));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file]);

  function handleMinimize() {
    minimize({
      id: WINDOW_ID,
      title: file ? `Edit: ${file.file_name}` : 'New File',
      icon: <FolderIcon sx={{ fontSize: 16, color: 'primary.main' }} />,
      onRestore: () => setMinimized(false),
    });
    setMinimized(true);
  }

  const isDirty = JSON.stringify(form) !== initial;

  function requestClose() {
    if (isDirty) setConfirmClose(true);
    else closeAndReset();
  }

  function closeAndReset() {
    setConfirmClose(false);
    remove(WINDOW_ID);
    onClose();
  }

  async function handleSave() {
    if (!form.file_name.trim()) { setError('File name is required.'); return; }
    if (!form.cabinet_id) { setError('Cabinet selection is required.'); return; }
    if (form.file_subject && form.file_subject.trim().length > 200) { setError('File Subject must be 200 characters or fewer.'); return; }
    const fileNumber = form.file_number.trim();
    if (fileNumber) {
      let dupQuery = supabase.from('physical_files').select('id').eq('file_number', fileNumber).limit(1);
      if (file) dupQuery = dupQuery.neq('id', file.id);
      const { data: dup } = await dupQuery;
      if (dup && dup.length > 0) { setError(`File Number "${fileNumber}" is already used by another file. File Numbers must be unique.`); return; }
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        file_number: fileNumber || null,
        file_subject: form.file_subject.trim() || null,
        assessment_year: form.assessment_year || null,
        financial_year: form.financial_year || null,
        client_id: form.client_id || null,
        cabinet_id: form.cabinet_id || null,
        current_holder_id: form.current_holder_id || null,
      };
      if (file) {
        const changed: Record<string, unknown> = {};
        const before: Record<string, unknown> = {};
        for (const key of Object.keys(payload) as (keyof typeof payload)[]) {
          const prevVal = (file as unknown as Record<string, unknown>)[key] ?? null;
          const nextVal = payload[key] ?? null;
          if (prevVal !== nextVal) { before[key] = prevVal; changed[key] = nextVal; }
        }
        await supabase.from('physical_files').update({ ...payload, updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', file.id);
        await logAudit({
          action: 'UPDATE', module: 'files', record_id: file.id,
          record_display: form.file_name,
          old_values: before, new_values: changed,
        }, user?.id, profile?.full_name);
      } else {
        const fileId = `FL${Date.now().toString().slice(-6)}`;
        const { data } = await supabase.from('physical_files').insert({ ...payload, file_id: fileId, created_by: user?.id, updated_by: user?.id }).select().single();
        await logAudit({ action: 'CREATE', module: 'files', record_id: (data as PhysicalFile)?.id, record_display: form.file_name }, user?.id, profile?.full_name);
      }
      remove(WINDOW_ID);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const statusOptions = FILE_STATUS_OPTIONS.filter(s => s !== 'archived' && s !== 'disposed');

  return (
    <>
      <Dialog open={open && !minimized} onClose={requestClose} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ pr: 12 }}>
          {file ? 'Edit File' : 'Add New File'}
          <IconButton onClick={handleMinimize} aria-label="Minimize" sx={{ position: 'absolute', right: 48, top: 8 }}><MinimizeIcon /></IconButton>
          <IconButton onClick={requestClose} aria-label="Close" sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="File Name *" value={form.file_name} onChange={e => setForm(p => ({ ...p, file_name: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="File Number" value={form.file_number} onChange={e => setForm(p => ({ ...p, file_number: e.target.value }))} fullWidth size="small" helperText="Must be unique across all files" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="File Subject" value={form.file_subject} onChange={e => setForm(p => ({ ...p, file_subject: e.target.value }))} fullWidth size="small" inputProps={{ maxLength: 200 }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Autocomplete
                options={clients}
                getOptionLabel={c => `${c.client_id} - ${c.client_name}`}
                value={clients.find(c => c.id === form.client_id) ?? null}
                onChange={(_, v) => setForm(p => ({ ...p, client_id: v?.id ?? '' }))}
                renderInput={params => <TextField {...params} label="Client" size="small" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Financial Year" value={form.financial_year} onChange={e => setForm(p => ({ ...p, financial_year: e.target.value, assessment_year: e.target.value ? getNextYearLabel(e.target.value) : p.assessment_year }))} fullWidth size="small">
                <MenuItem value="">-- None --</MenuItem>
                {financialYears.map(y => <MenuItem key={y.id} value={y.label}>{y.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Assessment Year" value={form.assessment_year} onChange={e => setForm(p => ({ ...p, assessment_year: e.target.value }))} fullWidth size="small">
                <MenuItem value="">-- None --</MenuItem>
                {assessmentYears.map(y => <MenuItem key={y.id} value={y.label}>{y.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Status" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} fullWidth size="small">
                {statusOptions.map(s => <MenuItem key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select required label="Cabinet *" value={form.cabinet_id} onChange={e => setForm(p => ({ ...p, cabinet_id: e.target.value }))} fullWidth size="small">
                <MenuItem value="">-- Select Cabinet --</MenuItem>
                {cabinets.map(c => <MenuItem key={c.id} value={c.id}>{c.cabinet_name}{c.cabinet_number ? ` (#${c.cabinet_number})` : ''}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField label="Shelf" value={form.shelf} onChange={e => setForm(p => ({ ...p, shelf: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField label="Rack" value={form.rack} onChange={e => setForm(p => ({ ...p, rack: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Current Holder" value={form.current_holder_id} onChange={e => setForm(p => ({ ...p, current_holder_id: e.target.value }))} fullWidth size="small">
                <MenuItem value="">-- None --</MenuItem>
                {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={12}>
              <TextField label="Remarks" value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} fullWidth size="small" multiline rows={2} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={requestClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {file ? 'Save' : 'Add File'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmClose}
        title="Discard Changes?"
        message="You have unsaved changes. Closing this form will discard them. Do you want to continue?"
        confirmLabel="Discard"
        onConfirm={closeAndReset}
        onCancel={() => setConfirmClose(false)}
      />
    </>
  );
}
