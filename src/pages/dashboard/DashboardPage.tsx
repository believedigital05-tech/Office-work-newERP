import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import PeopleIcon from '@mui/icons-material/People';
import FolderIcon from '@mui/icons-material/Folder';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AssignmentIcon from '@mui/icons-material/Assignment';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import WarningIcon from '@mui/icons-material/Warning';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import { format } from 'date-fns';

interface Stats {
  totalClients: number;
  activeClients: number;
  totalFiles: number;
  filesOut: number;
  overdueMovements: number;
  pendingActivities: number;
  todaysCouriers: number;
  totalCabinets: number;
  completedActivities: number;
  urgentActivities: number;
}

const COLORS = ['#1a3c6e', '#c8943a', '#2e7d32', '#d32f2f', '#0288d1'];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentClients, setRecentClients] = useState<Array<Record<string, unknown>>>([]);
  const [overdueFiles, setOverdueFiles] = useState<Array<Record<string, unknown>>>([]);
  const [upcomingActivities, setUpcomingActivities] = useState<Array<Record<string, unknown>>>([]);
  const [activityStatusData, setActivityStatusData] = useState<Array<{ name: string; value: number }>>([]);
  const [monthlyData, setMonthlyData] = useState<Array<{ month: string; clients: number; activities: number }>>([]);
  const [clientTypeData, setClientTypeData] = useState<Array<{ name: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [clientsRes, filesRes, movementsRes, activitiesRes, couriersRes, cabinetsRes, allActivitiesRes, clientTypesRes] = await Promise.all([
        supabase.from('clients').select('id, status, created_at, client_name, client_id, client_type:client_types(name)').eq('is_deleted', false).order('created_at', { ascending: false }),
        supabase.from('physical_files').select('id, status').eq('is_deleted', false).neq('status', 'archived'),
        supabase.from('file_movements').select('id, status, expected_return_date, file:physical_files(file_name), taken_by:employees(full_name)').eq('is_deleted', false).eq('status', 'out').order('expected_return_date'),
        supabase.from('activities').select('id, title, status, due_date, priority, client:clients(client_name)').eq('is_deleted', false).in('status', ['not_started', 'in_progress', 'on_hold']).order('due_date'),
        supabase.from('couriers').select('id').eq('is_deleted', false).gte('received_date', new Date().toISOString().split('T')[0]),
        supabase.from('cabinets').select('id').eq('is_deleted', false),
        supabase.from('activities').select('status').eq('is_deleted', false),
        supabase.from('clients').select('client_type:client_types(name)').eq('is_deleted', false),
      ]);

      const clients = clientsRes.data ?? [];
      const files = filesRes.data ?? [];
      const movements = movementsRes.data ?? [];
      const activities = activitiesRes.data ?? [];
      const today = new Date();

      const overdueMovements = movements.filter(m => {
        if (!m.expected_return_date) return false;
        return new Date(m.expected_return_date as string) < today;
      });

      setStats({
        totalClients: clients.length,
        activeClients: clients.filter(c => c.status === 'active').length,
        totalFiles: files.length,
        filesOut: files.filter(f => f.status === 'in_use' || f.status === 'sent_outside').length,
        overdueMovements: overdueMovements.length,
        pendingActivities: activities.length,
        todaysCouriers: couriersRes.data?.length ?? 0,
        totalCabinets: cabinetsRes.data?.length ?? 0,
        completedActivities: (allActivitiesRes.data ?? []).filter(a => a.status === 'completed').length,
        urgentActivities: activities.filter(a => a.priority === 'urgent' || a.priority === 'high').length,
      });

      setRecentClients(clients.slice(0, 5));
      setOverdueFiles(overdueMovements.slice(0, 5));
      setUpcomingActivities(activities.slice(0, 5));

      const statusCount: Record<string, number> = {};
      const allActs = allActivitiesRes.data ?? [];
      for (const a of allActs) {
        statusCount[a.status as string] = (statusCount[a.status as string] ?? 0) + 1;
      }
      setActivityStatusData(Object.entries(statusCount).map(([name, value]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        value,
      })));

      const months: Record<string, { clients: number; activities: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = format(d, 'MMM');
        months[key] = { clients: 0, activities: 0 };
      }
      for (const c of clients) {
        const key = format(new Date(c.created_at as string), 'MMM');
        if (months[key]) months[key].clients++;
      }
      const allActivitiesRes2 = (allActivitiesRes.data as Array<{ status: string; created_at?: string }>) ?? [];
      for (const a of allActivitiesRes2) {
        const key = format(new Date(a.created_at ?? new Date()), 'MMM');
        if (months[key]) months[key].activities++;
      }
      setMonthlyData(Object.entries(months).map(([month, v]) => ({ month, ...v })));

      // Client type distribution
      const typeCount: Record<string, number> = {};
      for (const c of ((clientTypesRes.data as unknown as Array<{ client_type: { name: string } | null }>) ?? [])) {
        const typeName = c.client_type?.name ?? 'Unknown';
        typeCount[typeName] = (typeCount[typeName] ?? 0) + 1;
      }
      setClientTypeData(Object.entries(typeCount).map(([name, value]) => ({ name, value })));
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Box display="flex" justifyContent="center" mt={6}><CircularProgress /></Box>;

  const statCards = [
    { label: 'Total Clients', value: stats?.totalClients ?? 0, sub: `${stats?.activeClients ?? 0} active`, icon: <PeopleIcon />, color: '#1a3c6e' },
    { label: 'Physical Files', value: stats?.totalFiles ?? 0, sub: `${stats?.filesOut ?? 0} out`, icon: <FolderIcon />, color: '#2e7d32' },
    { label: 'Overdue Movements', value: stats?.overdueMovements ?? 0, sub: 'files not returned', icon: <WarningIcon />, color: '#d32f2f' },
    { label: 'Pending Activities', value: stats?.pendingActivities ?? 0, sub: 'open tasks', icon: <AssignmentIcon />, color: '#c8943a' },
    { label: "Today's Couriers", value: stats?.todaysCouriers ?? 0, sub: 'received today', icon: <LocalShippingIcon />, color: '#0288d1' },
    { label: 'Files Out', value: stats?.filesOut ?? 0, sub: 'currently checked out', icon: <SwapHorizIcon />, color: '#7b1fa2' },
    { label: 'Cabinets', value: stats?.totalCabinets ?? 0, sub: 'storage units', icon: <FolderIcon />, color: '#00838f' },
    { label: 'Completed', value: stats?.completedActivities ?? 0, sub: 'activities done', icon: <AssignmentIcon />, color: '#2e7d32' },
  ];

  return (
    <Box>
      <PageHeader title="Dashboard" subtitle="Welcome to Lakhia And Co. Office Management ERP" />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((card) => (
          <Grid size={{ xs: 6, sm: 4, md: 3 }} key={card.label}>
            <Card>
              <CardContent sx={{ pb: '16px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar sx={{ bgcolor: card.color, width: { xs: 36, md: 44 }, height: { xs: 36, md: 44 }, flexShrink: 0 }}>
                    {card.icon}
                  </Avatar>
                  <Box>
                    <Typography variant="h5" fontWeight={700}>{card.value}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>{card.label}</Typography>
                    <Typography variant="caption" display="block" color="text.secondary">{card.sub}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} mb={2}>Monthly Overview</Typography>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip />
                <Bar dataKey="clients" name="Clients" fill="#1a3c6e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="activities" name="Activities" fill="#c8943a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} mb={2}>Activity Status</Typography>
            {activityStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={activityStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {activityStatusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box display="flex" alignItems="center" justifyContent="center" height={240}>
                <Typography color="text.secondary" variant="body2">No activities yet</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {clientTypeData.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>Clients by Type</Typography>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={clientTypeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <RechartsTooltip />
                  <Bar dataKey="value" name="Clients" fill="#1a3c6e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>Urgent Activities</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: 'error.light', color: 'white', minWidth: 100 }}>
                  <Typography variant="h4" fontWeight={700}>{stats?.urgentActivities ?? 0}</Typography>
                  <Typography variant="caption">Urgent / High</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: 'warning.light', color: 'white', minWidth: 100 }}>
                  <Typography variant="h4" fontWeight={700}>{stats?.pendingActivities ?? 0}</Typography>
                  <Typography variant="caption">Pending</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: 'success.light', color: 'white', minWidth: 100 }}>
                  <Typography variant="h4" fontWeight={700}>{stats?.completedActivities ?? 0}</Typography>
                  <Typography variant="caption">Completed</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: 'error.main', color: 'white', minWidth: 100 }}>
                  <Typography variant="h4" fontWeight={700}>{stats?.overdueMovements ?? 0}</Typography>
                  <Typography variant="caption">Overdue Files</Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} mb={1.5}>Recent Clients</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentClients.length === 0 ? (
                  <TableRow><TableCell colSpan={2} align="center">No clients yet</TableCell></TableRow>
                ) : recentClients.map((c) => (
                  <TableRow key={c.id as string} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{c.client_name as string}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.client_id as string}</Typography>
                    </TableCell>
                    <TableCell><StatusChip status={c.status as string} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} mb={1.5}>Overdue File Returns</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>File</TableCell>
                  <TableCell>Due Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overdueFiles.length === 0 ? (
                  <TableRow><TableCell colSpan={2} align="center">No overdue files</TableCell></TableRow>
                ) : overdueFiles.map((m) => (
                  <TableRow key={m.id as string} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {(m.file as { file_name: string })?.file_name ?? '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={m.expected_return_date ? format(new Date(m.expected_return_date as string), 'dd MMM yy') : '-'}
                        color="error"
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} mb={1.5}>Upcoming Activities</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Activity</TableCell>
                  <TableCell>Priority</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {upcomingActivities.length === 0 ? (
                  <TableRow><TableCell colSpan={2} align="center">No pending activities</TableCell></TableRow>
                ) : upcomingActivities.map((a) => (
                  <TableRow key={a.id as string} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{a.title as string}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {(a.client as { client_name: string })?.client_name ?? 'No client'}
                      </Typography>
                    </TableCell>
                    <TableCell><StatusChip status={a.priority as string} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
