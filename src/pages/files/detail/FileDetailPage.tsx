import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import { supabase } from '../../../lib/supabase';
import type { PhysicalFile, FileMovement } from '../../../types';
import StatusChip from '../../../components/common/StatusChip';
import { useAuth } from '../../../contexts/AuthContext';
import { format, isPast } from 'date-fns';

export default function FileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [file, setFile] = useState<PhysicalFile | null>(null);
  const [movements, setMovements] = useState<FileMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  const _canEdit = profile?.role === 'admin' || profile?.role === 'manager';
  void _canEdit;

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [fileRes, movRes] = await Promise.all([
      supabase.from('physical_files')
        .select('*, client:clients(client_name,client_id), cabinet:cabinets(cabinet_name), current_holder:employees(full_name)')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('file_movements')
        .select('*, taken_by:employees(full_name), received_by:employees(full_name)')
        .eq('file_id', id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
    ]);
    setFile(fileRes.data as PhysicalFile | null);
    setMovements((movRes.data as FileMovement[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>;
  }

  if (!file) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/files')}>Back to Files</Button>
        <Paper sx={{ p: 4, textAlign: 'center', mt: 2 }}>
          <Typography color="text.secondary">File not found.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link href="#" onClick={(e) => { e.preventDefault(); navigate('/files'); }}>Physical Files</Link>
        <Typography color="text.primary">{file.file_name}</Typography>
      </Breadcrumbs>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/files')} size="small"><ArrowBackIcon /></IconButton>
        <Typography variant="h5" fontWeight={700} color="primary.main" sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
          {file.file_name}
        </Typography>
        <Chip label={file.file_id} size="small" color="primary" sx={{ ml: 1 }} />
        <StatusChip status={file.status} />
      </Box>

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label="Overview" />
          <Tab label={`Movement History (${movements.length})`} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tab === 0 && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="overline" color="text.secondary">File Number</Typography>
                  <Typography variant="body1" fontWeight={500}>{file.file_number || '-'}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="overline" color="text.secondary">File Subject</Typography>
                  <Typography variant="body1" fontWeight={500}>{file.file_subject || '-'}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="overline" color="text.secondary">Client</Typography>
                  <Typography variant="body1" fontWeight={500}>{(file.client as { client_name: string } | undefined)?.client_name ?? '-'}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="overline" color="text.secondary">Assessment Year</Typography>
                  <Typography variant="body1" fontWeight={500}>{file.assessment_year || '-'}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="overline" color="text.secondary">Financial Year</Typography>
                  <Typography variant="body1" fontWeight={500}>{file.financial_year || '-'}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="overline" color="text.secondary">Status</Typography>
                  <Box sx={{ mt: 0.5 }}><StatusChip status={file.status} /></Box>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="overline" color="text.secondary">Cabinet</Typography>
                  <Typography variant="body1" fontWeight={500}>{(file.cabinet as { cabinet_name: string } | undefined)?.cabinet_name ?? '-'}</Typography>
                  {file.shelf && <Typography variant="caption" color="text.secondary">Shelf {file.shelf}</Typography>}
                  {file.rack && <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>Rack {file.rack}</Typography>}
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="overline" color="text.secondary">Current Holder</Typography>
                  <Typography variant="body1" fontWeight={500}>{(file.current_holder as { full_name: string } | undefined)?.full_name ?? 'In office'}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="overline" color="text.secondary">Last Movement</Typography>
                  <Typography variant="body1" fontWeight={500}>{file.last_movement_date ? format(new Date(file.last_movement_date), 'dd MMM yyyy HH:mm') : 'Never'}</Typography>
                </Paper>
              </Grid>
              {file.remarks && (
                <Grid size={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="overline" color="text.secondary">Remarks</Typography>
                    <Typography variant="body2">{file.remarks}</Typography>
                  </Paper>
                </Grid>
              )}
              <Grid size={12}>
                <Divider sx={{ my: 1 }} />
                <Button
                  variant="contained"
                  startIcon={<SwapHorizIcon />}
                  onClick={() => navigate('/movements')}
                >
                  Go to Movement Register
                </Button>
              </Grid>
            </Grid>
          )}

          {tab === 1 && (
            <Box>
              {movements.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <SwapHorizIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">No movement history for this file.</Typography>
                </Box>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 700 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Movement ID</TableCell>
                        <TableCell>Taken By</TableCell>
                        <TableCell>Taken Date</TableCell>
                        <TableCell>Expected Return</TableCell>
                        <TableCell>Returned Date</TableCell>
                        <TableCell>Received By</TableCell>
                        <TableCell>Purpose</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {movements.map(m => {
                        const isOverdue = m.status === 'out' && m.expected_return_date && isPast(new Date(m.expected_return_date));
                        return (
                          <TableRow key={m.id} hover sx={{ bgcolor: isOverdue ? 'error.50' : undefined }}>
                            <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{m.movement_id}</Typography></TableCell>
                            <TableCell>{(m.taken_by as { full_name: string } | undefined)?.full_name ?? '-'}</TableCell>
                            <TableCell>{format(new Date(m.taken_date), 'dd MMM yy HH:mm')}</TableCell>
                            <TableCell>{m.expected_return_date ? <Chip label={format(new Date(m.expected_return_date), 'dd MMM yy')} size="small" color={isOverdue ? 'error' : 'default'} /> : '-'}</TableCell>
                            <TableCell>{m.returned_date ? format(new Date(m.returned_date), 'dd MMM yy HH:mm') : '-'}</TableCell>
                            <TableCell>{(m.received_by as { full_name: string } | undefined)?.full_name ?? '-'}</TableCell>
                            <TableCell><Typography variant="caption">{m.purpose ?? '-'}</Typography></TableCell>
                            <TableCell>
                              {m.status === 'returned' ? (
                                <Chip icon={<CheckCircleIcon />} label="Returned" size="small" color="success" />
                              ) : isOverdue ? (
                                <Chip label="Overdue" size="small" color="error" />
                              ) : (
                                <Chip label="Out" size="small" color="warning" />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
