import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { useState, useEffect } from 'react';
import { createAppTheme } from './theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ClientsPage from './pages/clients/ClientsPage';
import ClientDetailPage from './pages/clients/ClientDetailPage';
import FilesPage from './pages/files/FilesPage';
import CabinetsPage from './pages/files/CabinetsPage';
import FileDetailPage from './pages/files/detail/FileDetailPage';
import CabinetDetailPage from './pages/files/CabinetDetailPage';
import MovementsPage from './pages/movements/MovementsPage';
import CouriersPage from './pages/couriers/CouriersPage';
import ActivitiesPage from './pages/activities/ActivitiesPage';
import SearchPage from './pages/search/SearchPage';
import ReportsPage from './pages/reports/ReportsPage';
import RecycleBinPage from './pages/recycle/RecycleBinPage';
import SettingsPage from './pages/settings/SettingsPage';
import ImportExportPage from './pages/import-export/ImportExportPage';
import AuditLogPage from './pages/audit/AuditLogPage';
import ShredderPage from './pages/shredder/ShredderPage';
import DisposedFilesPage from './pages/shredder/DisposedFilesPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
      <Route path="/clients/:id" element={<ProtectedRoute><ClientDetailPage /></ProtectedRoute>} />
      <Route path="/files" element={<ProtectedRoute><FilesPage /></ProtectedRoute>} />
      <Route path="/files/:id" element={<ProtectedRoute><FileDetailPage /></ProtectedRoute>} />
      <Route path="/cabinets" element={<ProtectedRoute><CabinetsPage /></ProtectedRoute>} />
      <Route path="/cabinets/:id" element={<ProtectedRoute><CabinetDetailPage /></ProtectedRoute>} />
      <Route path="/movements" element={<ProtectedRoute><MovementsPage /></ProtectedRoute>} />
      <Route path="/couriers" element={<ProtectedRoute><CouriersPage /></ProtectedRoute>} />
      <Route path="/activities" element={<ProtectedRoute><ActivitiesPage /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/import-export" element={<ProtectedRoute><ImportExportPage /></ProtectedRoute>} />
      <Route path="/shredder" element={<ProtectedRoute><ShredderPage /></ProtectedRoute>} />
      <Route path="/disposed-files" element={<ProtectedRoute><DisposedFilesPage /></ProtectedRoute>} />
      <Route path="/recycle" element={<ProtectedRoute><RecycleBinPage /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/settings/profile" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    const handler = () => setDarkMode(localStorage.getItem('darkMode') === 'true');
    window.addEventListener('storage', handler);
    window.addEventListener('darkModeChanged', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('darkModeChanged', handler);
    };
  }, []);

  const theme = createAppTheme(darkMode ? 'dark' : 'light');

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
