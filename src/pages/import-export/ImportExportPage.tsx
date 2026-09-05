import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../lib/audit';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const MODULES = [
  { key: 'clients', label: 'Clients' },
  { key: 'physical_files', label: 'Physical Files' },
  { key: 'couriers', label: 'Couriers' },
  { key: 'activities', label: 'Activities' },
];

interface PreviewRow {
  rowIndex: number;
  data: Record<string, unknown>;
  status: 'ok' | 'skip' | 'error';
  reason: string;
}

export default function ImportExportPage() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState(0);
  const [importModule, setImportModule] = useState('clients');
  const [exportModule, setExportModule] = useState('clients');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);
  const [batches, setBatches] = useState<Array<Record<string, unknown>>>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; batch: Record<string, unknown> | null }>({ open: false, batch: null });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => { loadBatches(); }, []);

  async function loadBatches() {
    const { data } = await supabase.from('import_batches').select('*').order('created_at', { ascending: false }).limit(50);
    setBatches(data ?? []);
  }

  function validateRow(module: string, row: Record<string, unknown>, rowIndex: number): PreviewRow {
    const data = { ...row };
    delete data.id;
    delete data.created_at;
    delete data.updated_at;
    delete data.is_deleted;

    if (module === 'clients') {
      if (!data.client_name) return { rowIndex, data, status: 'skip', reason: 'Missing client_name' };
      if (!data.client_id) data.client_id = `LAC-${Date.now().toString().slice(-6)}${rowIndex}`;
      data.status = data.status ?? 'active';
    }
    if (module === 'physical_files') {
      if (!data.file_name) return { rowIndex, data, status: 'skip', reason: 'Missing file_name' };
      if (!data.file_number) return { rowIndex, data, status: 'skip', reason: 'Missing file_number' };
      if (!data.file_id) data.file_id = `FL${Date.now().toString().slice(-6)}${rowIndex}`;
      data.status = data.status ?? 'available';
    }
    if (module === 'activities') {
      if (!data.title) return { rowIndex, data, status: 'skip', reason: 'Missing title' };
      if (!data.activity_id) data.activity_id = `AC${Date.now().toString().slice(-6)}${rowIndex}`;
      data.status = data.status ?? 'not_started';
      data.priority = data.priority ?? 'medium';
    }
    if (module === 'couriers') {
      if (!data.courier_id) data.courier_id = `CR${Date.now().toString().slice(-6)}${rowIndex}`;
      data.status = data.status ?? 'received';
      data.received_date = data.received_date ?? new Date().toISOString();
    }
    return { rowIndex, data, status: 'ok', reason: '' };
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewFile(file);
    setValidating(true);
    setMessage(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      if (rows.length === 0) {
        setMessage({ type: 'error', text: 'File is empty or has no valid rows.' });
        setPreviewFile(null);
        setValidating(false);
        return;
      }
      const previews = rows.map((row, i) => validateRow(importModule, row, i));
      setPreviewRows(previews);
      setPreviewOpen(true);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to read file' });
      setPreviewFile(null);
    } finally {
      setValidating(false);
      e.target.value = '';
    }
  }

  async function handleConfirmImport() {
    if (!previewFile) return;
    setImporting(true);
    setMessage(null);
    try {
      const okRows = previewRows.filter(r => r.status === 'ok');
      const skipRows = previewRows.filter(r => r.status === 'skip');
      let success = 0, errorCount = 0;
      const errors: Array<{ row: number; error: string }> = [];

      for (const row of okRows) {
        const { error: insertError } = await supabase.from(importModule).insert(row.data);
        if (insertError) {
          errorCount++;
          errors.push({ row: row.rowIndex + 2, error: insertError.message });
        } else {
          success++;
        }
      }
      skipRows.forEach(r => errors.push({ row: r.rowIndex + 2, error: r.reason }));

      const batchId = `IMP${Date.now().toString().slice(-6)}`;
      await supabase.from('import_batches').insert({
        batch_id: batchId,
        module: importModule,
        file_name: previewFile.name,
        total_rows: previewRows.length,
        success_count: success,
        skip_count: skipRows.length,
        error_count: errorCount,
        status: 'completed',
        error_report: errors,
        completed_at: new Date().toISOString(),
        created_by: user?.id,
      });

      await logAudit({ action: 'IMPORT', module: importModule, notes: `Imported ${success}/${previewRows.length} records from ${previewFile.name}` }, user?.id, profile?.full_name);

      let verifiedCount = 0;
      if (success > 0) {
        const { count: dbCount } = await supabase.from(importModule)
          .select('*', { count: 'exact', head: true })
          .eq('is_deleted', false)
          .gte('created_at', new Date(Date.now() - 60000).toISOString());
        verifiedCount = dbCount ?? 0;
      }

      if (success > 0 && verifiedCount === 0) {
        setMessage({ type: 'error', text: `Import reported ${success} successes but verification found 0 new rows in the database. The data may not have landed. Please check permissions and try again.` });
      } else if (verifiedCount < success) {
        setMessage({ type: 'warning', text: `Import complete: ${success} reported, ${verifiedCount} verified in database, ${skipRows.length} skipped, ${errorCount} errors. Some rows may not have persisted.` });
      } else {
        setMessage({ type: 'success', text: `Import complete: ${success} added and verified in database, ${skipRows.length} skipped, ${errorCount} errors.` });
      }

      setPreviewOpen(false);
      setPreviewRows([]);
      setPreviewFile(null);
      loadBatches();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setImporting(false);
    }
  }

  function downloadErrorReport() {
    const errorRows = previewRows
      .filter(r => r.status !== 'ok')
      .map(r => ({
        'Row': r.rowIndex + 2,
        'Status': r.status === 'skip' ? 'Skipped' : 'Error',
        'Reason': r.reason,
        'File': previewFile?.name ?? '',
      }));
    if (errorRows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(errorRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    XLSX.writeFile(wb, `import_errors_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function downloadBatchErrors(batch: Record<string, unknown>) {
    const report = batch.error_report as Array<{ row: number; error: string }> | null;
    if (!report || report.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(report);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    XLSX.writeFile(wb, `batch_${batch.batch_id}_errors.xlsx`);
  }

  async function handleExport() {
    setExporting(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.from(exportModule).select('*').eq('is_deleted', false);
      if (error) throw error;
      if (!data || data.length === 0) {
        setMessage({ type: 'info', text: 'No records found to export.' });
        setExporting(false);
        return;
      }
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, exportModule);
      XLSX.writeFile(wb, `${exportModule}_${new Date().toISOString().split('T')[0]}.xlsx`);
      setMessage({ type: 'success', text: `Exported ${data.length} records from ${exportModule}.` });
      await logAudit({ action: 'EXPORT', module: exportModule, notes: `Exported ${data.length} records` }, user?.id, profile?.full_name);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      setExporting(false);
    }
  }

  function downloadTemplate() {
    const sample: Record<string, string> = {};
    if (importModule === 'clients') {
      Object.assign(sample, { client_id: '', client_name: 'Sample Client', pan_number: '', gst_number: '', contact_person: '', mobile_number: '', email: '', status: 'active' });
    } else if (importModule === 'physical_files') {
      Object.assign(sample, { file_id: '', file_number: '001', file_name: 'Sample File', status: 'available' });
    } else if (importModule === 'couriers') {
      Object.assign(sample, { courier_id: '', sender: 'Sender Name', receiver: 'Receiver Name', tracking_number: '', status: 'received' });
    } else {
      Object.assign(sample, { activity_id: '', title: 'Sample Activity', priority: 'medium', status: 'not_started' });
    }
    const ws = XLSX.utils.json_to_sheet([sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${importModule}_template.xlsx`);
  }

  const okCount = previewRows.filter(r => r.status === 'ok').length;
  const skipCount = previewRows.filter(r => r.status === 'skip').length;
  const errorCount = previewRows.filter(r => r.status === 'error').length;

  return (
    <Box>
      <PageHeader title="Import / Export" subtitle="Bulk import and export data" />

      {message && <Alert severity={message.type} sx={{ mb: 2 }}>{message.text}</Alert>}

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label="Export" />
          <Tab label="Import" />
          <Tab label="History" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tab === 0 && (
            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField select label="Module" value={exportModule} onChange={e => setExportModule(e.target.value)} fullWidth size="small">
                  {MODULES.map(m => <MenuItem key={m.key} value={m.key}>{m.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Button variant="contained" startIcon={exporting ? <CircularProgress size={18} color="inherit" /> : <FileDownloadIcon />} onClick={handleExport} disabled={exporting} fullWidth>
                  Export to Excel
                </Button>
              </Grid>
            </Grid>
          )}

          {tab === 1 && (
            <Box>
              <Grid container spacing={3} alignItems="center" sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <TextField select label="Module" value={importModule} onChange={e => setImportModule(e.target.value)} fullWidth size="small">
                    {MODULES.map(m => <MenuItem key={m.key} value={m.key}>{m.label}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Button variant="outlined" onClick={downloadTemplate}>Download Template</Button>
                </Grid>
              </Grid>
              <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center' }}>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} id="import-file" style={{ display: 'none' }} />
                <label htmlFor="import-file">
                  <Button component="span" variant="contained" startIcon={validating ? <CircularProgress size={18} color="inherit" /> : <FileUploadIcon />} disabled={validating}>
                    {validating ? 'Reading file...' : 'Choose File to Import'}
                  </Button>
                </label>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  Upload an Excel or CSV file. You'll see a validation preview before anything is saved.
                </Typography>
              </Box>
            </Box>
          )}

          {tab === 2 && (
            <Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Batch ID</TableCell>
                    <TableCell>Module</TableCell>
                    <TableCell>File</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Success</TableCell>
                    <TableCell>Skipped</TableCell>
                    <TableCell>Errors</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batches.length === 0 ? <TableRow><TableCell colSpan={9} align="center">No import history</TableCell></TableRow>
                    : (rowsPerPage > 0 ? batches.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) : batches).map(b => (
                      <TableRow key={b.id as string} hover>
                        <TableCell><Typography variant="body2" fontWeight={600}>{b.batch_id as string}</Typography></TableCell>
                        <TableCell>{b.module as string}</TableCell>
                        <TableCell>{b.file_name as string ?? '-'}</TableCell>
                        <TableCell>{b.total_rows as number}</TableCell>
                        <TableCell><Typography color="success.main" fontWeight={600}>{b.success_count as number}</Typography></TableCell>
                        <TableCell><Typography color="warning.main">{b.skip_count as number}</Typography></TableCell>
                        <TableCell><Typography color="error.main">{b.error_count as number}</Typography></TableCell>
                        <TableCell>{format(new Date(b.created_at as string), 'dd MMM yy HH:mm')}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => setErrorDialog({ open: true, batch: b })} title="View details">
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {batches.length > rowsPerPage && (
                <TablePagination
                  component="div"
                  count={batches.length}
                  page={page}
                  onPageChange={(_, p) => setPage(p)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Validation Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>Validation Preview — {previewFile?.name}</Box>
          <IconButton onClick={() => setPreviewOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Chip icon={<CheckCircleIcon />} label={`${okCount} ready to import`} color="success" size="small" />
            {skipCount > 0 && <Chip icon={<WarningAmberIcon />} label={`${skipCount} will be skipped`} color="warning" size="small" />}
            {errorCount > 0 && <Chip icon={<CancelIcon />} label={`${errorCount} errors`} color="error" size="small" />}
            {(skipCount > 0 || errorCount > 0) && (
              <Button size="small" startIcon={<FileDownloadIcon />} onClick={downloadErrorReport}>Download error report</Button>
            )}
          </Box>
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Row</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Key fields</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {previewRows.map(r => (
                  <TableRow key={r.rowIndex} hover>
                    <TableCell>{r.rowIndex + 2}</TableCell>
                    <TableCell>
                      {r.status === 'ok' ? <Chip label="OK" color="success" size="small" />
                        : r.status === 'skip' ? <Chip label="Skip" color="warning" size="small" />
                        : <Chip label="Error" color="error" size="small" />}
                    </TableCell>
                    <TableCell>{r.reason || '-'}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {importModule === 'clients' && `${r.data.client_name ?? '-'}`}
                        {importModule === 'physical_files' && `${r.data.file_name ?? '-'}`}
                        {importModule === 'activities' && `${r.data.title ?? '-'}`}
                        {importModule === 'couriers' && `${r.data.sender ?? '-'} → ${r.data.receiver ?? '-'}`}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </DialogContent>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={() => setPreviewOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmImport}
            disabled={importing || okCount === 0}
            startIcon={importing ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {importing ? 'Importing...' : `Import ${okCount} row${okCount !== 1 ? 's' : ''}`}
          </Button>
        </Box>
      </Dialog>

      {/* Batch Error Detail Dialog */}
      <Dialog open={errorDialog.open} onClose={() => setErrorDialog({ open: false, batch: null })} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>Batch Details — {errorDialog.batch?.batch_id as string ?? ''}</Box>
          <IconButton onClick={() => setErrorDialog({ open: false, batch: null })} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {(() => {
            const b = errorDialog.batch;
            if (!b) return null;
            const report = b.error_report as Array<{ row: number; error: string }> | null;
            return (
              <Box>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={3}><Typography variant="overline" color="text.secondary">File</Typography><Typography variant="body2">{b.file_name as string ?? '-'}</Typography></Grid>
                  <Grid size={3}><Typography variant="overline" color="text.secondary">Module</Typography><Typography variant="body2">{b.module as string}</Typography></Grid>
                  <Grid size={2}><Typography variant="overline" color="text.secondary">Total</Typography><Typography variant="body2" fontWeight={600}>{b.total_rows as number}</Typography></Grid>
                  <Grid size={2}><Typography variant="overline" color="text.secondary">Success</Typography><Typography variant="body2" fontWeight={600} color="success.main">{b.success_count as number}</Typography></Grid>
                  <Grid size={2}><Typography variant="overline" color="text.secondary">Errors</Typography><Typography variant="body2" fontWeight={600} color="error.main">{b.error_count as number}</Typography></Grid>
                </Grid>
                {report && report.length > 0 ? (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2">Error Details ({report.length})</Typography>
                      <Button size="small" startIcon={<FileDownloadIcon />} onClick={() => downloadBatchErrors(b)}>Download</Button>
                    </Box>
                    <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Row</TableCell>
                            <TableCell>Error</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {report.map((e, i) => (
                            <TableRow key={i} hover>
                              <TableCell>{e.row}</TableCell>
                              <TableCell><Typography variant="caption">{e.error}</Typography></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  </Box>
                ) : (
                  <Alert severity="success">No errors in this batch — all rows imported successfully.</Alert>
                )}
              </Box>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
