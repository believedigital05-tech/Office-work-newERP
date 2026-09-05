import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import FolderIcon from '@mui/icons-material/Folder';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SearchIcon from '@mui/icons-material/Search';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import HistoryIcon from '@mui/icons-material/History';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useAuth } from '../../contexts/AuthContext';

const DRAWER_WIDTH = 240;

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles?: string[];
  children?: { label: string; path: string }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { label: 'Clients', icon: <PeopleIcon />, path: '/clients' },
  {
    label: 'Physical Files', icon: <FolderIcon />, path: '/files',
    children: [
      { label: 'File Master', path: '/files' },
      { label: 'Cabinets', path: '/cabinets' },
      { label: 'Shredder', path: '/shredder' },
      { label: 'Disposed Files', path: '/disposed-files' },
    ],
  },
  { label: 'File Movement', icon: <SwapHorizIcon />, path: '/movements' },
  { label: 'Courier Register', icon: <LocalShippingIcon />, path: '/couriers' },
  { label: 'Activities', icon: <AssignmentIcon />, path: '/activities' },
  { label: 'Global Search', icon: <SearchIcon />, path: '/search' },
  { label: 'Reports', icon: <BarChartIcon />, path: '/reports' },
  { label: 'Import / Export', icon: <ImportExportIcon />, path: '/import-export', roles: ['admin', 'manager'] },
  { label: 'Recycle Bin', icon: <DeleteIcon />, path: '/recycle', roles: ['admin', 'manager'] },
  { label: 'Audit Log', icon: <HistoryIcon />, path: '/audit', roles: ['admin', 'manager'] },
  { label: 'Settings', icon: <SettingsIcon />, path: '/settings', roles: ['admin', 'manager'] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
    window.dispatchEvent(new Event('darkModeChanged'));
  }, [darkMode]);

  // Ctrl/Cmd+K shortcut for global search
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        navigate('/search');
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const role = profile?.role ?? 'staff';
  const visibleItems = navItems.filter(item => !item.roles || item.roles.includes(role));

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white', minHeight: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ lineHeight: 1.2 }}>
          Lakhia And Co.
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.75, fontSize: '0.7rem' }}>
          Office ERP
        </Typography>
      </Box>
      <Divider />
      <List sx={{ flex: 1, pt: 0.5, overflow: 'auto' }}>
        {visibleItems.map((item) => {
          if (item.children) {
            const isExpanded = expanded === item.label;
            const isActive = item.children.some(c => location.pathname === c.path);
            return (
              <React.Fragment key={item.label}>
                <ListItem disablePadding>
                  <ListItemButton
                    selected={isActive}
                    onClick={() => setExpanded(isExpanded ? null : item.label)}
                    sx={{ py: 0.8, pl: 2 }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: isActive ? 'primary.main' : 'inherit' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.875rem' }} />
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={isExpanded}>
                  <List disablePadding>
                    {item.children.map(child => (
                      <ListItem key={child.path} disablePadding>
                        <ListItemButton
                          component={RouterLink}
                          to={child.path}
                          selected={location.pathname === child.path}
                          sx={{ pl: 6, py: 0.6 }}
                          onClick={() => setMobileOpen(false)}
                        >
                          <ListItemText primary={child.label} primaryTypographyProps={{ fontSize: '0.8rem' }} />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </React.Fragment>
            );
          }
          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                component={RouterLink}
                to={item.path}
                selected={location.pathname === item.path || location.pathname.startsWith(item.path + '/')}
                onClick={() => setMobileOpen(false)}
                sx={{
                  py: 0.8, pl: 2,
                  '&.Mui-selected': {
                    bgcolor: 'primary.light',
                    color: 'white',
                    '& .MuiListItemIcon-root': { color: 'white' },
                    '&:hover': { bgcolor: 'primary.main' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.875rem' }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ p: 1.5, bgcolor: 'action.hover' }}>
        <Typography variant="caption" color="text.secondary" display="block" fontWeight={500}>
          v4.0.1 — {profile?.role?.toUpperCase()}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: 'primary.dark' }}
        elevation={0}
      >
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <IconButton color="inherit" onClick={() => setMobileOpen(!mobileOpen)} sx={{ display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1 }}>
            {visibleItems.find(n => location.pathname === n.path || location.pathname.startsWith(n.path + '/'))?.label ?? 'ERP'}
          </Typography>
          <Tooltip title="Search (Ctrl+K)">
            <IconButton color="inherit" onClick={() => navigate('/search')}>
              <SearchIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle theme">
            <IconButton color="inherit" onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Notifications">
            <IconButton color="inherit">
              <Badge badgeContent={0} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title={profile?.full_name ?? 'Account'}>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
              <Avatar sx={{ width: 30, height: 30, bgcolor: 'secondary.main', fontSize: '0.85rem' }}>
                {profile?.full_name?.[0] ?? '?'}
              </Avatar>
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem disabled>
          <Box>
            <Typography variant="body2" fontWeight={600}>{profile?.full_name}</Typography>
            <Typography variant="caption" color="text.secondary">{profile?.role}</Typography>
          </Box>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setAnchorEl(null); navigate('/settings/profile'); }}>
          <ListItemIcon><AccountCircleIcon fontSize="small" /></ListItemIcon>
          My Profile
        </MenuItem>
        <MenuItem onClick={handleSignOut}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          Sign Out
        </MenuItem>
      </Menu>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
        }}
      >
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default', minHeight: '100vh' }}>
        <Toolbar variant="dense" />
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
