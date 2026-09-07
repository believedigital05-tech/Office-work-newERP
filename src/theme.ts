import { createTheme, responsiveFontSizes } from '@mui/material/styles';

const baseTypography = {
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  h1: { fontWeight: 700, letterSpacing: '-0.025em' },
  h2: { fontWeight: 700, letterSpacing: '-0.02em' },
  h3: { fontWeight: 700, letterSpacing: '-0.015em' },
  h4: { fontWeight: 700, letterSpacing: '-0.01em' },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
  subtitle1: { fontWeight: 500 },
  subtitle2: { fontWeight: 600 },
  button: { fontWeight: 600, letterSpacing: '0.02em' },
  overline: { fontWeight: 600, letterSpacing: '0.08em' },
};

export function createAppTheme(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';

  const theme = createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#60a5fa' : '#2563eb',
        light: isDark ? '#93c5fd' : '#3b82f6',
        dark: isDark ? '#3b82f6' : '#1d4ed8',
        contrastText: isDark ? '#0f172a' : '#ffffff',
      },
      secondary: {
        main: isDark ? '#fbbf24' : '#f59e0b',
        light: isDark ? '#fcd34d' : '#fbbf24',
        dark: isDark ? '#f59e0b' : '#d97706',
        contrastText: isDark ? '#0f172a' : '#ffffff',
      },
      background: {
        default: isDark ? '#0a0f1e' : '#f1f5f9',
        paper: isDark ? '#131a2e' : '#ffffff',
      },
      text: {
        primary: isDark ? '#f1f5f9' : '#0f172a',
        secondary: isDark ? '#94a3b8' : '#64748b',
      },
      divider: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.08)',
      success: {
        main: isDark ? '#34d399' : '#16a34a',
        light: isDark ? '#6ee7b7' : '#22c55e',
        dark: isDark ? '#10b981' : '#15803d',
        contrastText: isDark ? '#0f172a' : '#ffffff',
      },
        warning: {
          main: isDark ? '#fbbf24' : '#f59e0b',
          light: isDark ? '#fcd34d' : '#fbbf24',
          dark: isDark ? '#f59e0b' : '#d97706',
          contrastText: isDark ? '#0f172a' : '#ffffff',
        },
        error: {
          main: isDark ? '#f87171' : '#dc2626',
          light: isDark ? '#fca5a5' : '#ef4444',
          dark: isDark ? '#ef4444' : '#b91c1c',
          contrastText: isDark ? '#0f172a' : '#ffffff',
        },
        info: {
          main: isDark ? '#38bdf8' : '#0ea5e9',
          light: isDark ? '#7dd3fc' : '#38bdf8',
          dark: isDark ? '#0ea5e9' : '#0284c7',
          contrastText: isDark ? '#0f172a' : '#ffffff',
        },
    },
    typography: baseTypography,
    shape: { borderRadius: 12 },
    shadows: isDark
      ? [
          'none',
          '0 1px 2px rgba(0,0,0,0.3)',
          '0 2px 4px rgba(0,0,0,0.3)',
          '0 4px 8px rgba(0,0,0,0.3)',
          '0 6px 12px rgba(0,0,0,0.35)',
          '0 8px 16px rgba(0,0,0,0.35)',
          '0 10px 20px rgba(0,0,0,0.4)',
          '0 12px 24px rgba(0,0,0,0.4)',
          '0 14px 28px rgba(0,0,0,0.45)',
          '0 16px 32px rgba(0,0,0,0.45)',
          '0 18px 36px rgba(0,0,0,0.5)',
          '0 20px 40px rgba(0,0,0,0.5)',
          '0 22px 44px rgba(0,0,0,0.55)',
          '0 24px 48px rgba(0,0,0,0.55)',
          '0 26px 52px rgba(0,0,0,0.6)',
          '0 28px 56px rgba(0,0,0,0.6)',
          '0 30px 60px rgba(0,0,0,0.65)',
          '0 32px 64px rgba(0,0,0,0.65)',
          '0 34px 68px rgba(0,0,0,0.7)',
          '0 36px 72px rgba(0,0,0,0.7)',
          '0 38px 76px rgba(0,0,0,0.75)',
          '0 40px 80px rgba(0,0,0,0.75)',
          '0 42px 84px rgba(0,0,0,0.8)',
          '0 44px 88px rgba(0,0,0,0.8)',
          '0 46px 92px rgba(0,0,0,0.85)',
        ]
      : [
          'none',
          '0 1px 2px rgba(15,23,42,0.04)',
          '0 2px 4px rgba(15,23,42,0.06)',
          '0 4px 8px rgba(15,23,42,0.06)',
          '0 6px 12px rgba(15,23,42,0.07)',
          '0 8px 16px rgba(15,23,42,0.08)',
          '0 10px 20px rgba(15,23,42,0.08)',
          '0 12px 24px rgba(15,23,42,0.09)',
          '0 14px 28px rgba(15,23,42,0.1)',
          '0 16px 32px rgba(15,23,42,0.1)',
          '0 18px 36px rgba(15,23,42,0.1)',
          '0 20px 40px rgba(15,23,42,0.12)',
          '0 22px 44px rgba(15,23,42,0.12)',
          '0 24px 48px rgba(15,23,42,0.14)',
          '0 26px 52px rgba(15,23,42,0.14)',
          '0 28px 56px rgba(15,23,42,0.16)',
          '0 30px 60px rgba(15,23,42,0.16)',
          '0 32px 64px rgba(15,23,42,0.18)',
          '0 34px 68px rgba(15,23,42,0.18)',
          '0 36px 72px rgba(15,23,42,0.2)',
          '0 38px 76px rgba(15,23,42,0.2)',
          '0 40px 80px rgba(15,23,42,0.22)',
          '0 42px 84px rgba(15,23,42,0.22)',
          '0 44px 88px rgba(15,23,42,0.24)',
          '0 46px 92px rgba(15,23,42,0.24)',
        ],
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: 10, padding: '8px 18px' },
          sizeSmall: { padding: '5px 12px', fontSize: '0.8125rem' },
          sizeLarge: { padding: '11px 24px' },
          contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 500, borderRadius: 8 },
          sizeSmall: { fontSize: '0.75rem' },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 16,
            border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.06)'}`,
            backgroundImage: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none', borderRadius: 12 },
          rounded: { borderRadius: 12 },
        },
      },
      MuiTextField: {
        defaultProps: { size: 'small', variant: 'outlined' },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: isDark ? 'rgba(148,163,184,0.06)' : 'transparent',
          },
          notchedOutline: {
            borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.12)',
          },
        },
      },
      MuiSelect: {
        styleOverrides: { select: { paddingTop: 8.5, paddingBottom: 8.5 } },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-root': {
              fontWeight: 700,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              backgroundColor: isDark ? 'rgba(96,165,250,0.08)' : 'rgba(37,99,235,0.04)',
              color: isDark ? '#93c5fd' : '#1e40af',
              borderBottom: `2px solid ${isDark ? 'rgba(96,165,250,0.2)' : 'rgba(37,99,235,0.12)'}`,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.06)'}` },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:last-child .MuiTableCell-root': { borderBottom: 0 },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? '#0d1424' : '#ffffff',
            borderRight: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(15,23,42,0.06)'}`,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#0d1424' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#0f172a',
            borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(15,23,42,0.06)'}`,
            boxShadow: 'none',
          },
        },
      },
      MuiToolbar: {
        styleOverrides: { dense: { minHeight: 56, paddingLeft: 16, paddingRight: 16 } },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: '2px 8px',
            '&.Mui-selected': {
              backgroundColor: isDark ? 'rgba(96,165,250,0.12)' : 'rgba(37,99,235,0.08)',
              color: isDark ? '#93c5fd' : '#2563eb',
              '& .MuiListItemIcon-root': { color: isDark ? '#93c5fd' : '#2563eb' },
              '&:hover': { backgroundColor: isDark ? 'rgba(96,165,250,0.18)' : 'rgba(37,99,235,0.12)' },
            },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: { root: { minWidth: 38 } },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontSize: '0.75rem', borderRadius: 6 },
          arrow: {},
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 16 },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 40,
          },
          indicator: {
            height: 3,
            borderRadius: 3,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            minHeight: 40,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10, fontWeight: 500 },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': { width: 8, height: 8 },
            '&::-webkit-scrollbarTrack': { background: 'transparent' },
            '&::-webkit-scrollbarThumb': {
              backgroundColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.12)',
              borderRadius: 4,
            },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: 12 },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: { borderRadius: 6, margin: '2px 4px' },
        },
      },
    },
  });

  return responsiveFontSizes(theme);
}

const theme = createAppTheme('light');
export default theme;
