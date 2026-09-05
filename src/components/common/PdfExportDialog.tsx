import { useState, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import PrintIcon from '@mui/icons-material/Print';
import { format } from 'date-fns';

export interface PdfColumn {
  key: string;
  label: string;
  selectedByDefault?: boolean;
}

export interface PdfRow {
  [key: string]: string | number | null | undefined;
}

interface PdfExportDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  columns: PdfColumn[];
  rows: PdfRow[];
  filtersDescription?: string;
}

export default function PdfExportDialog({ open, onClose, title, columns, rows, filtersDescription }: PdfExportDialogProps) {
  const defaultSelected = useMemo(() => {
    const set = new Set<string>();
    columns.forEach(c => { if (c.selectedByDefault !== false) set.add(c.key); });
    return set;
  }, [columns]);

  const [selected, setSelected] = useState<Set<string>>(defaultSelected);
  const [printing, setPrinting] = useState(false);

  const selectedColumns = columns.filter(c => selected.has(c.key));

  function toggleColumn(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(columns.map(c => c.key))); }
  function selectDefaults() { setSelected(defaultSelected); }

  function buildHtml(): string {
    const now = format(new Date(), 'dd MMM yyyy, HH:mm');
    let body = '';
    if (selectedColumns.length === 0 || rows.length === 0) {
      body = '<p>No data to display.</p>';
    } else {
      body += '<table><thead><tr>';
      body += '<th>#</th>';
      selectedColumns.forEach(c => { body += `<th>${c.label}</th>`; });
      body += '</tr></thead><tbody>';
      rows.forEach((row, i) => {
        body += `<tr><td>${i + 1}</td>`;
        selectedColumns.forEach(c => {
          const val = row[c.key];
          body += `<td>${val ?? '-'}</td>`;
        });
        body += '</tr>';
      });
      body += '</tbody></table>';
    }

    const filterNote = filtersDescription ? `<div class="filters">Filters: ${filtersDescription}</div>` : '';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        * { font-family: 'Roboto', Arial, sans-serif; box-sizing: border-box; }
        body { margin: 16px; color: #333; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .meta { font-size: 12px; color: #666; margin-bottom: 8px; }
        .filters { font-size: 12px; color: #555; margin-bottom: 16px; font-style: italic; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
        th { background: #f5f5f5; text-align: left; padding: 4px 6px; border: 1px solid #ddd; font-weight: 600; white-space: nowrap; }
        td { padding: 3px 6px; border: 1px solid #ddd; }
        tr:nth-child(even) { background: #fafafa; }
        @page { margin: 1.5cm; }
        .page-num:after { content: counter(page); }
        @media print { body { margin: 8px; } table { page-break-inside: auto; } tr { page-break-inside: avoid; } }
      </style></head><body>
      <h1>${title}</h1>
      <div class="meta">Generated: ${now} &middot; Lakhia And Co. Office ERP</div>
      ${filterNote}
      ${body}
      </body></html>`;
  }

  function handlePrint() {
    setPrinting(true);
    try {
      const html = buildHtml();
      const win = window.open('', '_blank', 'width=900,height=650');
      if (!win) { alert('Please allow pop-ups to print.'); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 350);
    } finally {
      setPrinting(false);
      onClose();
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Print / Export PDF - {title}</DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
          Select the columns to include in the PDF. The output will open in a new window where you can save it as PDF or print it.
        </Alert>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Button size="small" onClick={selectAll}>Select All</Button>
          <Button size="small" onClick={selectDefaults}>Default Selection</Button>
        </Stack>
        <Stack spacing={0.5}>
          {columns.map(c => (
            <FormControlLabel
              key={c.key}
              control={<Checkbox size="small" checked={selected.has(c.key)} onChange={() => toggleColumn(c.key)} />}
              label={<Typography variant="body2">{c.label}</Typography>}
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handlePrint} variant="contained" disabled={printing || selectedColumns.length === 0}
          startIcon={printing ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />}>
          Generate PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
}
