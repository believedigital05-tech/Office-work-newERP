import { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { supabase } from '../../lib/supabase';
import type { PhysicalFile, FileMovement } from '../../types';
import StatusChip from '../common/StatusChip';
import { format, isPast } from 'date-fns';

interface FileViewDialogProps {
  open: boolean;
  fileId: string | null;
  onClose: () => void;
}

export default function FileViewDialog({ open, fileId, onClose }: FileViewDialogProps) {
  const [file, setFile] = useState<PhysicalFile | null>(null);
  const [movements, setMovements] = useState<FileMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);

  const loadData = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    const [fileRes, movRes] = await Promise.all([
      supabase.from('physical_files')
        .select('*, client:clients(client_name,client_id), cabinet:cabinets(cabinet_name,cabinet_number), current_holder:employees(full_name)')
        .eq('id', fileId)
        .maybeSingle(),
      supabase.from('file_movements')
        .select('*, taken_by:employees!file_movements_taken_by_id_fkey(full_name), received_by:employees!file_movements_received_by_id_fkey(full_name)')
        .eq('file_id', fileId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
    ]);
    setFile(fileRes.data as PhysicalFile | null);
    setMovements((movRes.data as FileMovement[]) ?? []);
    setLoading(false);
  }, [fileId]);

  useEffect(() => { if (open && fileId) { setTab(0); loadData(); } }, [open, fileId, loadData]);

  function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
      <Box sx={{ py: 0.5, display: 'flex', gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140, flexShrink: 0 }}>{label}:</Typography>
        <Typography variant="body2">{value || '-'}</Typography>
      </Box>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={false}>
      <DialogTitle sx={{ pr: 6 }}>
        {file?.file_name ?? 'File View'}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
          : !file ? <Typography color="text.secondary">File not found.</Typography>
          : (
            <Box>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tab label="Overview" />
                <Tab label={`Movement History (${movements.length})`} />
              </Tabs>

              {tab === 0 && (
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="overline" color="text.secondary">File Information</Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <InfoRow label="File ID" value={file.file_id} />
                        <InfoRow label="File Name" value={file.file_name} />
                        <InfoRow label="File Number" value={file.file_number} />
                        <InfoRow label="File Subject" value={file.file_subject} />
                        <InfoRow label="Client" value={(file.client as { client_name: string } | undefined)?.client_name} />
                        <InfoRow label="AY" value={file.assessment_year} />
                        <InfoRow label="FY" value={file.financial_year} />
                        <Box sx={{ py: 0.5, display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140, flexShrink: 0 }}>Status:</Typography>
                          <StatusChip status={file.status} />
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="overline" color="text.secondary">Physical Location</Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <InfoRow label="Cabinet" value={(file.cabinet as { cabinet_name: string } | undefined)?.cabinet_name ?? 'Not Assigned'} />
                        <InfoRow label="Shelf" value={file.shelf} />
                        <InfoRow label="Rack" value={file.rack} />
                      </Box>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 2, mt: 1.5 }}>
                      <Typography variant="overline" color="text.secondary">Current Status</Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <InfoRow label="Current Holder" value={(file.current_holder as { full_name: string } | undefined)?.full_name ?? 'In office'} />
                        <InfoRow label="Last Moved" value={file.last_movement_date ? format(new Date(file.last_movement_date), 'dd MMM yyyy HH:mm') : 'Never'} />
                        <InfoRow label="Created Date" value={format(new Date(file.created_at), 'dd MMM yyyy')} />
                        <InfoRow label="Updated Date" value={format(new Date(file.updated_at), 'dd MMM yyyy')} />
                      </Box>
                    </Paper>
                  </Grid>
                  {file.remarks && (
                    <Grid size={12}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="overline" color="text.secondary">Remarks</Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>{file.remarks}</Typography>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              )}

              {tab === 1 && (
                <Box>
                  {movements.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary">No movement history for this file.</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: 700 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Movement ID</TableCell>
                            <TableCell>Taken By</TableCell>
                            <TableCell>Purpose</TableCell>
                            <TableCell>Taken Date</TableCell>
                            <TableCell>Expected Return</TableCell>
                            <TableCell>Returned Date</TableCell>
                            <TableCell>Received By</TableCell>
                            <TableCell>Remarks</TableCell>
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
                                <TableCell><Typography variant="caption">{m.purpose ?? '-'}</Typography></TableCell>
                                <TableCell>{format(new Date(m.taken_date), 'dd MMM yy HH:mm')}</TableCell>
                                <TableCell>{m.expected_return_date ? <Chip label={format(new Date(m.expected_return_date), 'dd MMM yy')} size="small" color={isOverdue ? 'error' : 'default'} /> : '-'}</TableCell>
                                <TableCell>{m.returned_date ? format(new Date(m.returned_date), 'dd MMM yy HH:mm') : '-'}</TableCell>
                                <TableCell>{(m.received_by as { full_name: string } | undefined)?.full_name ?? '-'}</TableCell>
                                <TableCell><Typography variant="caption">{m.remarks ?? '-'}</Typography></TableCell>
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
          )
        }
      </DialogContent>
    </Dialog>
  );
}
