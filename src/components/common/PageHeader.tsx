import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import { Link as RouterLink } from 'react-router-dom';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  action?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, breadcrumbs, action }: PageHeaderProps) {
  return (
    <Box sx={{ mb: 3 }}>
      {breadcrumbs && (
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1 }}>
          {breadcrumbs.map((b, i) =>
            b.path ? (
              <Link key={i} component={RouterLink} to={b.path} color="inherit" underline="hover" variant="body2">
                {b.label}
              </Link>
            ) : (
              <Typography key={i} variant="body2" color="text.primary">{b.label}</Typography>
            )
          )}
        </Breadcrumbs>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h5" fontWeight={700} color="primary.main" sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}>{title}</Typography>
          {subtitle && <Typography variant="body2" color="text.secondary" mt={0.25}>{subtitle}</Typography>}
        </Box>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Box>
    </Box>
  );
}
