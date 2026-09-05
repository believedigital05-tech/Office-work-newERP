import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import { useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  requireReason?: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmColor?: 'error' | 'warning' | 'primary';
}

export default function ConfirmDialog({
  open, title, message, requireReason, onConfirm, onCancel,
  confirmLabel = 'Confirm', confirmColor = 'error',
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');

  function handleConfirm() {
    if (requireReason && !reason.trim()) return;
    onConfirm(requireReason ? reason : undefined);
    setReason('');
  }

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">{message}</Typography>
        {requireReason && (
          <TextField
            label="Reason (required)"
            fullWidth
            multiline
            rows={2}
            value={reason}
            onChange={e => setReason(e.target.value)}
            sx={{ mt: 2 }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          color={confirmColor}
          variant="contained"
          disabled={requireReason && !reason.trim()}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
