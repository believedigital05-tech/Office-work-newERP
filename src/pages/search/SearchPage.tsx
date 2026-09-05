import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import PdfExportDialog, { type PdfColumn, type PdfRow } from '../../components/common/PdfExportDialog';
import SearchIcon from '@mui/icons-material/Search';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import { format } from 'date-fns';

interface SearchResults {
  clients: Array<Record<string, unknown>>;
  files: Array<Record<string, unknown>>;
  movements: Array<Record<string, unknown>>;
  couriers: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [tab, setTab] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [pdfOpen, setPdfOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('recentSearches');
    if (stored) setRecentSearches(JSON.parse(stored));
  }, []);

  function saveRecentSearch(q: string) {
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 8);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  }

  function clearRecentSearches() {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const q = query.trim();
    saveRecentSearch(q);

    const [clientsRes, filesRes, movementsRes, couriersRes, activitiesRes] = await Promise.all([
      supabase.from('clients').select('id,client_id,client_name,status,pan_number,mobile_number,email').eq('is_deleted', false).or(`client_name.ilike.%${q}%,client_id.ilike.%${q}%,pan_number.ilike.%${q}%,mobile_number.ilike.%${q}%,email.ilike.%${q}%,gst_number.ilike.%${q}%`).limit(20),
      supabase.from('physical_files').select('id,file_id,file_name,file_subject,status,client:clients(client_name)').eq('is_deleted', false).neq('status', 'archived').or(`file_name.ilike.%${q}%,file_id.ilike.%${q}%,file_number.ilike.%${q}%,file_subject.ilike.%${q}%`).limit(20),
      supabase.from('file_movements').select('id,movement_id,purpose,status,taken_date,file:physical_files(file_name)').eq('is_deleted', false).or(`movement_id.ilike.%${q}%,purpose.ilike.%${q}%`).limit(20),
      supabase.from('couriers').select('id,courier_id,sender,receiver,tracking_number,status,received_date').eq('is_deleted', false).or(`courier_id.ilike.%${q}%,tracking_number.ilike.%${q}%,sender.ilike.%${q}%,receiver.ilike.%${q}%`).limit(20),
      supabase.from('activities').select('id,activity_id,title,status,due_date,client:clients(client_name)').eq('is_deleted', false).or(`title.ilike.%${q}%,activity_id.ilike.%${q}%,notes.ilike.%${q}%`).limit(20),
    ]);

    setResults({
      clients: clientsRes.data ?? [],
      files: filesRes.data ?? [],
      movements: movementsRes.data ?? [],
      couriers: couriersRes.data ?? [],
      activities: activitiesRes.data ?? [],
    });
    setLoading(false);
    setTab(0);
  }

  const tabs = results ? [
    { label: `Clients (${results.clients.length})` },
    { label: `Files (${results.files.length})` },
    { label: `Movements (${results.movements.length})` },
    { label: `Couriers (${results.couriers.length})` },
    { label: `Activities (${results.activities.length})` },
  ] : [];

  const totalResults = results ? Object.values(results).reduce((s, arr) => s + arr.length, 0) : 0;

  return (
    <Box>
      <PageHeader title="Global Search" subtitle="Search across all modules" action={<Button variant="outlined" onClick={() => setPdfOpen(true)} disabled={!results}>Export PDF</Button>} />

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box component="form" onSubmit={handleSearch} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            placeholder="Search clients, files, couriers, activities..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          <Button type="submit" variant="contained" disabled={loading || !query.trim()} sx={{ whiteSpace: 'nowrap', px: 3 }}>
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Search'}
          </Button>
        </Box>
      </Paper>

      {results && (
        <Paper>
          <Box sx={{ px: 2, pt: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
              {tabs.map((t, i) => <Tab key={i} label={t.label} />)}
            </Tabs>
            <Typography variant="caption" color="text.secondary" pr={2}>{totalResults} results</Typography>
          </Box>

          <Box sx={{ p: 2 }}>
            {tab === 0 && (
              <Table size="small">
                <TableHead><TableRow><TableCell>Client ID</TableCell><TableCell>Name</TableCell><TableCell>Mobile</TableCell><TableCell>Email</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {results.clients.length === 0 ? <TableRow><TableCell colSpan={5} align="center">No clients found</TableCell></TableRow>
                    : results.clients.map(c => <TableRow key={c.id as string} hover onClick={() => navigate(`/clients/${c.id}`)} sx={{ cursor: 'pointer' }}>
                      <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{c.client_id as string}</Typography></TableCell>
                      <TableCell>{c.client_name as string}</TableCell>
                      <TableCell>{c.mobile_number as string ?? '-'}</TableCell>
                      <TableCell>{c.email as string ?? '-'}</TableCell>
                      <TableCell><StatusChip status={c.status as string} /></TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
            )}

            {tab === 1 && (
              <Table size="small">
                <TableHead><TableRow><TableCell>File ID</TableCell><TableCell>File Name</TableCell><TableCell>Subject</TableCell><TableCell>Client</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {results.files.length === 0 ? <TableRow><TableCell colSpan={5} align="center">No files found</TableCell></TableRow>
                    : results.files.map(f => <TableRow key={f.id as string} hover onClick={() => navigate(`/files/${f.id}`)} sx={{ cursor: 'pointer' }}>
                      <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{f.file_id as string}</Typography></TableCell>
                      <TableCell>{f.file_name as string}</TableCell>
                      <TableCell><Typography variant="caption">{f.file_subject as string ?? '-'}</Typography></TableCell>
                      <TableCell>{(f.client as { client_name: string } | undefined)?.client_name ?? '-'}</TableCell>
                      <TableCell><StatusChip status={f.status as string} /></TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
            )}

            {tab === 2 && (
              <Table size="small">
                <TableHead><TableRow><TableCell>Movement ID</TableCell><TableCell>File</TableCell><TableCell>Purpose</TableCell><TableCell>Date</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {results.movements.length === 0 ? <TableRow><TableCell colSpan={5} align="center">No movements found</TableCell></TableRow>
                    : results.movements.map(m => <TableRow key={m.id as string} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/movements`)}>
                      <TableCell><Typography variant="body2" fontWeight={600}>{m.movement_id as string}</Typography></TableCell>
                      <TableCell>{(m.file as { file_name: string } | undefined)?.file_name ?? '-'}</TableCell>
                      <TableCell>{m.purpose as string ?? '-'}</TableCell>
                      <TableCell>{format(new Date(m.taken_date as string), 'dd MMM yy')}</TableCell>
                      <TableCell><StatusChip status={m.status as string} /></TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
            )}

            {tab === 3 && (
              <Table size="small">
                <TableHead><TableRow><TableCell>Courier ID</TableCell><TableCell>Sender</TableCell><TableCell>Receiver</TableCell><TableCell>Tracking</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {results.couriers.length === 0 ? <TableRow><TableCell colSpan={5} align="center">No couriers found</TableCell></TableRow>
                    : results.couriers.map(c => <TableRow key={c.id as string} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/couriers`)}>
                      <TableCell><Typography variant="body2" fontWeight={600}>{c.courier_id as string}</Typography></TableCell>
                      <TableCell>{c.sender as string ?? '-'}</TableCell>
                      <TableCell>{c.receiver as string ?? '-'}</TableCell>
                      <TableCell>{c.tracking_number as string ?? '-'}</TableCell>
                      <TableCell><StatusChip status={c.status as string} /></TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
            )}

            {tab === 4 && (
              <Table size="small">
                <TableHead><TableRow><TableCell>Activity ID</TableCell><TableCell>Title</TableCell><TableCell>Client</TableCell><TableCell>Due Date</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {results.activities.length === 0 ? <TableRow><TableCell colSpan={5} align="center">No activities found</TableCell></TableRow>
                    : results.activities.map(a => <TableRow key={a.id as string} hover>
                      <TableCell><Typography variant="body2" fontWeight={600}>{a.activity_id as string}</Typography></TableCell>
                      <TableCell>{a.title as string}</TableCell>
                      <TableCell>{(a.client as { client_name: string } | undefined)?.client_name ?? '-'}</TableCell>
                      <TableCell>{a.due_date ? format(new Date(a.due_date as string), 'dd MMM yy') : '-'}</TableCell>
                      <TableCell><StatusChip status={a.status as string} /></TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
            )}
          </Box>
        </Paper>
      )}

      {!results && !loading && (
        <Box>
          {recentSearches.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="overline" color="text.secondary">Recent Searches</Typography>
                <Button size="small" onClick={clearRecentSearches}>Clear</Button>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {recentSearches.map(s => (
                  <Chip key={s} label={s} size="small" clickable onClick={() => { setQuery(s); }} />
                ))}
              </Stack>
            </Paper>
          )}
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <SearchIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">Enter a search term above to find clients, files, couriers, and activities.</Typography>
          </Paper>
        </Box>
      )}

      <PdfExportDialog
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        title="Global Search Results"
        columns={[
          { key: 'type', label: 'Type' },
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name/Title' },
          { key: 'detail', label: 'Detail' },
          { key: 'status', label: 'Status' },
        ] as PdfColumn[]}
        rows={results ? [
          ...results.clients.map(c => ({ type: 'Client', id: c.client_id as string, name: c.client_name as string, detail: (c.mobile_number as string) ?? '-', status: c.status as string })),
          ...results.files.map(f => ({ type: 'File', id: f.file_id as string, name: f.file_name as string, detail: (f.file_subject as string) ?? '-', status: f.status as string })),
          ...results.movements.map(m => ({ type: 'Movement', id: m.movement_id as string, name: (m.file as { file_name: string } | undefined)?.file_name ?? '-', detail: (m.purpose as string) ?? '-', status: m.status as string })),
          ...results.couriers.map(c => ({ type: 'Courier', id: c.courier_id as string, name: (c.sender as string) ?? '-', detail: (c.tracking_number as string) ?? '-', status: c.status as string })),
          ...results.activities.map(a => ({ type: 'Activity', id: a.activity_id as string, name: a.title as string, detail: (a.client as { client_name: string } | undefined)?.client_name ?? '-', status: a.status as string })),
        ] as PdfRow[] : []}
        filtersDescription={query ? `Search: ${query}` : undefined}
      />
    </Box>
  );
}
