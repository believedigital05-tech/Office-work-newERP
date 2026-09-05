import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

const COLORS = ['#1a3c6e', '#c8943a', '#2e7d32', '#d32f2f', '#0288d1', '#7b1fa2'];

export default function ReportsPage() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientStatusData, setClientStatusData] = useState<Array<{ name: string; value: number }>>([]);
  const [activityData, setActivityData] = useState<Array<Record<string, unknown>>>([]);
  const [fileStatusData, setFileStatusData] = useState<Array<{ name: string; value: number }>>([]);
  const [overdueData, setOverdueData] = useState<Array<Record<string, unknown>>>([]);
  const [auditData, setAuditData] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => { loadAllReports(); }, []);

  async function loadAllReports() {
    setLoading(true);
    await Promise.all([loadClientReport(), loadActivityReport(), loadFileReport(), loadOverdueReport(), loadAuditReport()]);
    setLoading(false);
  }

  async function loadClientReport() {
    const { data } = await supabase.from('clients').select('status').eq('is_deleted', false);
    const counts: Record<string, number> = {};
    for (const c of (data ?? [])) counts[c.status as string] = (counts[c.status as string] ?? 0) + 1;
    setClientStatusData(Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })));
  }

  async function loadActivityReport() {
    let query = supabase.from('activities').select('id,title,status,priority,due_date,client:clients(client_name),assigned_employee:employees(full_name)').eq('is_deleted', false).order('due_date');
    if (dateFrom) query = query.gte('due_date', dateFrom);
    if (dateTo) query = query.lte('due_date', dateTo);
    const { data } = await query;
    setActivityData(data ?? []);
  }

  async function loadFileReport() {
    const { data } = await supabase.from('physical_files').select('status').eq('is_deleted', false);
    const counts: Record<string, number> = {};
    for (const f of (data ?? [])) counts[f.status as string] = (counts[f.status as string] ?? 0) + 1;
    setFileStatusData(Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), value })));
  }

  async function loadOverdueReport() {
    const { data } = await supabase.from('file_movements')
      .select('id,movement_id,expected_return_date,file:physical_files(file_name), taken_by:employees(full_name)')
      .eq('is_deleted', false).eq('status', 'out').lt('expected_return_date', new Date().toISOString()).order('expected_return_date');
    setOverdueData(data ?? []);
  }

  async function loadAuditReport() {
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
    setAuditData(data ?? []);
  }

  function exportActivities() {
    const rows = activityData.map(a => ({
      'Activity ID': a.activity_id,
      'Title': a.title,
      'Client': (a.client as { client_name: string } | undefined)?.client_name ?? '',
      'Assigned To': (a.assigned_employee as { full_name: string } | undefined)?.full_name ?? '',
      'Priority': a.priority,
      'Status': a.status,
      'Due Date': a.due_date ? format(new Date(a.due_date as string), 'dd/MM/yyyy') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Activities');
    XLSX.writeFile(wb, `activities_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function exportOverdue() {
    const rows = overdueData.map(m => ({
      'Movement ID': m.movement_id,
      'File': (m.file as { file_name: string } | undefined)?.file_name ?? '',
      'Taken By': (m.taken_by as { full_name: string } | undefined)?.full_name ?? '',
      'Expected Return': m.expected_return_date ? format(new Date(m.expected_return_date as string), 'dd/MM/yyyy') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Overdue');
    XLSX.writeFile(wb, `overdue_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  return (
    <Box>
      <PageHeader title="Reports & Analytics" subtitle="View and export reports" />

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label="Client Summary" />
          <Tab label="Activity Report" />
          <Tab label="File Status" />
          <Tab label="Overdue Returns" />
          <Tab label="Audit Log" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {loading && <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>}

          {!loading && tab === 0 && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle1" fontWeight={600} mb={2}>Clients by Status</Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={clientStatusData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {clientStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle1" fontWeight={600} mb={2}>Distribution</Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={clientStatusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" name="Clients" fill="#1a3c6e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Grid>
            </Grid>
          )}

          {!loading && tab === 1 && (
            <Box>
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField label="From Date" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
                <TextField label="To Date" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
                <Button onClick={loadActivityReport} variant="outlined" size="small">Filter</Button>
                <Button startIcon={<FileDownloadIcon />} onClick={exportActivities} variant="contained" size="small">Export</Button>
                <Typography variant="body2" color="text.secondary">{activityData.length} records</Typography>
              </Box>
              <Table size="small">
                <TableHead><TableRow><TableCell>Title</TableCell><TableCell>Client</TableCell><TableCell>Assigned</TableCell><TableCell>Priority</TableCell><TableCell>Due</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {activityData.length === 0 ? <TableRow><TableCell colSpan={6} align="center">No data</TableCell></TableRow>
                    : activityData.map(a => <TableRow key={a.id as string} hover>
                      <TableCell>{a.title as string}</TableCell>
                      <TableCell>{(a.client as { client_name: string } | undefined)?.client_name ?? '-'}</TableCell>
                      <TableCell>{(a.assigned_employee as { full_name: string } | undefined)?.full_name ?? '-'}</TableCell>
                      <TableCell><StatusChip status={a.priority as string} /></TableCell>
                      <TableCell>{a.due_date ? format(new Date(a.due_date as string), 'dd MMM yy') : '-'}</TableCell>
                      <TableCell><StatusChip status={a.status as string} /></TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
            </Box>
          )}

          {!loading && tab === 2 && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle1" fontWeight={600} mb={2}>Files by Status</Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={fileStatusData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {fileStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={fileStatusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2e7d32" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Grid>
            </Grid>
          )}

          {!loading && tab === 3 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={600}>Overdue File Returns ({overdueData.length})</Typography>
                <Button startIcon={<FileDownloadIcon />} onClick={exportOverdue} variant="outlined" size="small">Export</Button>
              </Box>
              <Table size="small">
                <TableHead><TableRow><TableCell>Movement ID</TableCell><TableCell>File</TableCell><TableCell>Taken By</TableCell><TableCell>Expected Return</TableCell><TableCell>Days Overdue</TableCell></TableRow></TableHead>
                <TableBody>
                  {overdueData.length === 0 ? <TableRow><TableCell colSpan={5} align="center">No overdue returns</TableCell></TableRow>
                    : overdueData.map(m => {
                      const daysOverdue = Math.floor((Date.now() - new Date(m.expected_return_date as string).getTime()) / 86400000);
                      return <TableRow key={m.id as string} hover sx={{ bgcolor: daysOverdue > 7 ? 'error.50' : undefined }}>
                        <TableCell>{m.movement_id as string}</TableCell>
                        <TableCell>{(m.file as { file_name: string } | undefined)?.file_name ?? '-'}</TableCell>
                        <TableCell>{(m.taken_by as { full_name: string } | undefined)?.full_name ?? '-'}</TableCell>
                        <TableCell>{format(new Date(m.expected_return_date as string), 'dd MMM yyyy')}</TableCell>
                        <TableCell><StatusChip status="overdue" />&nbsp;{daysOverdue} days</TableCell>
                      </TableRow>;
                    })}
                </TableBody>
              </Table>
            </Box>
          )}

          {!loading && tab === 4 && (
            <Table size="small">
              <TableHead><TableRow><TableCell>Date/Time</TableCell><TableCell>User</TableCell><TableCell>Action</TableCell><TableCell>Module</TableCell><TableCell>Record</TableCell></TableRow></TableHead>
              <TableBody>
                {auditData.length === 0 ? <TableRow><TableCell colSpan={5} align="center">No audit logs</TableCell></TableRow>
                  : auditData.map(a => <TableRow key={a.id as string} hover>
                    <TableCell><Typography variant="caption">{format(new Date(a.created_at as string), 'dd MMM yy HH:mm')}</Typography></TableCell>
                    <TableCell>{a.user_name as string ?? '-'}</TableCell>
                    <TableCell><StatusChip status={a.action as string} /></TableCell>
                    <TableCell>{a.module as string}</TableCell>
                    <TableCell>{a.record_display as string ?? a.record_id as string ?? '-'}</TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
