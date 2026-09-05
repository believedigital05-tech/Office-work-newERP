import { createTheme } from '@mui/material/styles';

const baseTypography = {
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  h4: { fontWeight: 600 },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
};

const sharedComponents = {
  MuiButton: {
    styleOverrides: {
      root: { textTransform: 'none', fontWeight: 500 },
    },
  },
  MuiChip: {
    styleOverrides: { root: { fontWeight: 500 } },
  },
  MuiCard: {
    styleOverrides: { root: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' } },
  },
  MuiPaper: {
    styleOverrides: { root: { backgroundImage: 'none' } },
  },
};

export function createAppTheme(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#1a3c6e',
        light: '#2d5ba9',
        dark: '#0f2448',
      },
      secondary: {
        main: '#c8943a',
        light: '#e0b060',
        dark: '#9a6c22',
      },
      background: {
        default: isDark ? '#0f172a' : '#f0f4f8',
        paper: isDark ? '#1e293b' : '#ffffff',
      },
      text: {
        primary: isDark ? '#e2e8f0' : '#1e293b',
        secondary: isDark ? '#94a3b8' : '#64748b',
      },
      success: { main: '#2e7d32' },
      warning: { main: '#ed6c02' },
      error: { main: '#d32f2f' },
      info: { main: '#0288d1' },
    },
    typography: baseTypography,
    shape: { borderRadius: 8 },
    components: {
      ...sharedComponents,
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-root': {
              fontWeight: 600,
              backgroundColor: isDark ? '#1a3c6e' : '#1a3c6e',
              color: '#ffffff',
            },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#0f172a' : '#0f2448',
          },
        },
      },
    },
  });
}

const theme = createAppTheme('light');
export default theme;
