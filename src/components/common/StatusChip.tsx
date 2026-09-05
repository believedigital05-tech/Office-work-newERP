import Chip from '@mui/material/Chip';
import type { ChipProps } from '@mui/material/Chip';

const statusColors: Record<string, ChipProps['color']> = {
  active: 'success', inactive: 'default', onboarding: 'info', exited: 'error',
  available: 'success', in_use: 'warning', sent_outside: 'info', archived: 'default', missing: 'error', disposed: 'error',
  out: 'warning', returned: 'success', overdue: 'error',
  received: 'info', delivered: 'success', pending: 'warning', returned_c: 'default', cancelled: 'error',
  not_started: 'default', in_progress: 'info', completed: 'success', on_hold: 'warning',
  low: 'default', medium: 'info', high: 'warning', urgent: 'error',
  new: 'info', resolved: 'success',
};

const statusLabels: Record<string, string> = {
  not_started: 'Not Started', in_progress: 'In Progress', on_hold: 'On Hold',
  sent_outside: 'Sent Outside', in_use: 'In Use',
};

interface StatusChipProps {
  status: string;
  size?: ChipProps['size'];
}

export default function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const label = statusLabels[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const color = statusColors[status] ?? 'default';
  return <Chip label={label} color={color} size={size} />;
}
