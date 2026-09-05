import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { supabase } from '../../lib/supabase';
import type { Client } from '../../types';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import ClientDialog from './ClientDialog';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [files, setFiles] = useState<Array<Record<string, unknown>>>([]);
  const [activities, setActivities] = useState<Array<Record<string, unknown>>>([]);
  const [couriers, setCouriers] = useState<Array<Record<string, unknown>>>([]);
  const [notes, setNotes] = useState<Array<Record<string, unknown>>>([]);
  const [newNote, setNewNote] = useState('');

  const canSeeSensitive = profile?.role === 'admin' || profile?.role === 'manager';
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  useEffect(() => {
    if (id) loadClient();
  }, [id]);

  async function loadClient() {
    setLoading(true);
    const { data } = await supabase
      .from('clients')
      .select('*, client_type:client_types(name), assigned_employee:employees(full_name)')
      .eq('id', id!)
      .maybeSingle();
    setClient(data as Client);
    setLoading(false);
    loadRelated();
  }

  async function loadRelated() {
    const [filesRes, activitiesRes, couriersRes, notesRes] = await Promise.all([
      supabase.from('physical_files').select('*, cabinet:cabinets(cabinet_name)').eq('client_id', id!).eq('is_deleted', false).neq('status', 'archived'),
      supabase.from('activities').select('*, activity_type:activity_types(name)').eq('client_id', id!).eq('is_deleted', false).order('created_at', { ascending: false }),
      supabase.from('couriers').select('*, courier_company:courier_companies(name)').eq('client_id', id!).eq('is_deleted', false).order('received_date', { ascending: false }),
      supabase.from('client_notes').select('*').eq('client_id', id!).eq('is_deleted', false).order('created_at', { ascending: false }),
    ]);
    setFiles(filesRes.data ?? []);
    setActivities(activitiesRes.data ?? []);
    setCouriers(couriersRes.data ?? []);
    setNotes(notesRes.data ?? []);
  }

  async function addNote() {
    if (!newNote.trim()) return;
    await supabase.from('client_notes').insert({ client_id: id!, note_text: newNote, created_by: user?.id });
    setNewNote('');
    loadRelated();
  }

  async function deleteNote(noteId: string) {
    await supabase.from('client_notes').update({ is_deleted: true }).eq('id', noteId);
    loadRelated();
  }

  if (loading) return <Box display="flex" justifyContent="center" mt={6}><CircularProgress /></Box>;
  if (!client) return <Box><Typography>Client not found.</Typography><Button onClick={() => navigate('/clients')}>Back</Button></Box>;

  const masked = (v?: string) => canSeeSensitive ? (v ?? '-') : (v ? '••••••••' : '-');

  function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
      <Box sx={{ py: 0.75, display: 'flex', gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160, flexShrink: 0 }}>{label}:</Typography>
        <Typography variant="body2">{value ?? '-'}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={client.client_name}
        subtitle={`Client ID: ${client.client_id}`}
        breadcrumbs={[{ label: 'Clients', path: '/clients' }, { label: client.client_name }]}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/clients')} variant="outlined" size="small">Back</Button>
            {canEdit && <Button startIcon={<EditIcon />} onClick={() => setEditOpen(true)} variant="contained" size="small">Edit</Button>}
          </Box>
        }
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>Client Information</Typography>
              <StatusChip status={client.status} size="medium" />
            </Box>
            <Grid container spacing={1}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <InfoRow label="Client Name" value={client.client_name} />
                <InfoRow label="Client Type" value={(client.client_type as { name: string } | undefined)?.name} />
                <InfoRow label="Contact Person" value={client.contact_person} />
                <InfoRow label="Mobile" value={client.mobile_number} />
                <InfoRow label="Email" value={client.email} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <InfoRow label="PAN" value={masked(client.pan_number)} />
                <InfoRow label="GST" value={masked(client.gst_number)} />
                <InfoRow label="TAN" value={masked(client.tan)} />
                <InfoRow label="CIN" value={masked(client.cin)} />
                <InfoRow label="Assigned To" value={(client.assigned_employee as { full_name: string } | undefined)?.full_name} />
              </Grid>
              {client.office_address && (
                <Grid size={12}>
                  <Divider sx={{ my: 1 }} />
                  <InfoRow label="Office Address" value={client.office_address} />
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} mb={1.5}>Quick Stats</Typography>
            {[
              { label: 'Physical Files', value: files.length },
              { label: 'Open Activities', value: activities.filter(a => a.status !== 'completed' && a.status !== 'cancelled').length },
              { label: 'Couriers', value: couriers.length },
              { label: 'Notes', value: notes.length },
            ].map(s => (
              <Box key={s.label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                <Chip label={s.value} size="small" color="primary" />
              </Box>
            ))}
            <Box sx={{ pt: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Created: {format(new Date(client.created_at), 'dd MMM yyyy')}</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label={`Files (${files.length})`} />
          <Tab label={`Activities (${activities.length})`} />
          <Tab label={`Couriers (${couriers.length})`} />
          <Tab label={`Notes (${notes.length})`} />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {tab === 0 && (
            <Table size="small">
              <TableHead><TableRow><TableCell>File ID</TableCell><TableCell>File Number</TableCell><TableCell>File Name</TableCell><TableCell>Cabinet</TableCell><TableCell>Shelf</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>
                {files.length === 0 ? <TableRow><TableCell colSpan={6} align="center">No files linked</TableCell></TableRow>
                  : files.map(f => (
                    <TableRow key={f.id as string} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/files/${f.id}`)}>
                      <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{f.file_id as string}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{(f.file_number as string) || '-'}</Typography></TableCell>
                      <TableCell><Typography variant="body2" fontWeight={500}>{f.file_name as string}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{(f.cabinet as { cabinet_name: string } | undefined)?.cabinet_name ?? '-'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{(f.shelf as string) ?? '-'}</Typography></TableCell>
                      <TableCell><StatusChip status={f.status as string} /></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {tab === 1 && (
            <Table size="small">
              <TableHead><TableRow><TableCell>Activity</TableCell><TableCell>Type</TableCell><TableCell>Due Date</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>
                {activities.length === 0 ? <TableRow><TableCell colSpan={4} align="center">No activities</TableCell></TableRow>
                  : activities.map(a => (
                    <TableRow key={a.id as string} hover>
                      <TableCell><Typography variant="body2" fontWeight={500}>{a.title as string}</Typography></TableCell>
                      <TableCell>{(a.activity_type as { name: string } | undefined)?.name ?? '-'}</TableCell>
                      <TableCell>{a.due_date ? format(new Date(a.due_date as string), 'dd MMM yyyy') : '-'}</TableCell>
                      <TableCell><StatusChip status={a.status as string} /></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {tab === 2 && (
            <Table size="small">
              <TableHead><TableRow><TableCell>Courier ID</TableCell><TableCell>Date</TableCell><TableCell>Company</TableCell><TableCell>Tracking</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>
                {couriers.length === 0 ? <TableRow><TableCell colSpan={5} align="center">No couriers</TableCell></TableRow>
                  : couriers.map(c => (
                    <TableRow key={c.id as string} hover>
                      <TableCell>{c.courier_id as string}</TableCell>
                      <TableCell>{format(new Date(c.received_date as string), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{(c.courier_company as { name: string } | undefined)?.name ?? c.courier_company_name as string ?? '-'}</TableCell>
                      <TableCell>{c.tracking_number as string ?? '-'}</TableCell>
                      <TableCell><StatusChip status={c.status as string} /></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {tab === 3 && (
            <Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField size="small" fullWidth multiline maxRows={4} placeholder="Add a note..." value={newNote} onChange={e => setNewNote(e.target.value)} />
                <Button variant="contained" startIcon={<AddIcon />} onClick={addNote} disabled={!newNote.trim()}>Add</Button>
              </Box>
              {notes.length === 0 ? <Typography color="text.secondary" variant="body2">No notes yet</Typography>
                : notes.map(n => (
                  <Paper key={n.id as string} variant="outlined" sx={{ p: 1.5, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="body2">{n.note_text as string}</Typography>
                      <Typography variant="caption" color="text.secondary">{format(new Date(n.created_at as string), 'dd MMM yyyy HH:mm')}</Typography>
                    </Box>
                    <IconButton size="small" color="error" onClick={() => deleteNote(n.id as string)}><DeleteIcon fontSize="small" /></IconButton>
                  </Paper>
                ))}
            </Box>
          )}
        </Box>
      </Paper>

      <ClientDialog open={editOpen} client={client} onClose={() => setEditOpen(false)} onSaved={loadClient} />
    </Box>
  );
}
