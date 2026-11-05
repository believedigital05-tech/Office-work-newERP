import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { useMinimize } from '../../contexts/MinimizeContext';

export default function Taskbar() {
  const { minimized, restore, remove } = useMinimize();

  if (minimized.length === 0) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1300,
        px: 2,
        py: 1,
        borderRadius: 0,
        borderTop: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(13,20,36,0.95)' : 'rgba(255,255,255,0.98)',
        backdropFilter: 'blur(8px)',
        animation: 'taskbarSlideUp 0.25s ease-out',
        '@keyframes taskbarSlideUp': {
          from: { transform: 'translateY(100%)', opacity: 0 },
          to: { transform: 'translateY(0)', opacity: 1 },
        },
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mr: 1 }}>
          Minimized ({minimized.length})
        </Typography>
        {minimized.map(win => (
          <Box
            key={win.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.5,
              py: 0.5,
              borderRadius: 1.5,
              border: 1,
              borderColor: 'divider',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: 'primary.50',
                borderColor: 'primary.main',
                transform: 'translateY(-1px)',
              },
              animation: 'taskbarItemIn 0.2s ease-out',
              '@keyframes taskbarItemIn': {
                from: { transform: 'scale(0.9)', opacity: 0 },
                to: { transform: 'scale(1)', opacity: 1 },
              },
            }}
            onClick={() => restore(win.id)}
          >
            {win.icon}
            <Typography variant="caption" fontWeight={600} noWrap sx={{ maxWidth: 180 }}>
              {win.title}
            </Typography>
            <Tooltip title="Restore">
              <OpenInFullIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            </Tooltip>
            <Tooltip title="Close">
              <IconButton
                size="small"
                sx={{ p: 0.25 }}
                onClick={(e) => { e.stopPropagation(); remove(win.id); }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
