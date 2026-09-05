import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import BusinessIcon from '@mui/icons-material/Business';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Please enter email and password.'); return; }
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      let msg = 'Login failed. Please check your credentials.';
      if (err instanceof Error) {
        msg = err.message || msg;
      } else if (err && typeof err === 'object' && 'message' in err) {
        msg = String((err as { message: string }).message) || msg;
      }
      setError(msg.includes('Invalid') || msg.includes('credentials') ? 'Invalid email or password.' : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a3c6e 0%, #0f2448 60%, #c8943a 100%)',
        p: 2,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          p: { xs: 3, sm: 5 },
          width: '100%',
          maxWidth: 420,
          borderRadius: 3,
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 2,
              bgcolor: 'primary.main',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <BusinessIcon sx={{ fontSize: 36, color: 'white' }} />
          </Box>
          <Typography variant="h5" fontWeight={700} color="primary.main">
            Lakhia And Co.
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Office Management ERP
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSignIn}>
          <TextField
            label="Email Address"
            type="email"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2 }}
            autoComplete="email"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><EmailIcon color="action" /></InputAdornment>
              ),
            }}
          />
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 3 }}
            autoComplete="current-password"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><LockIcon color="action" /></InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" textAlign="center" mt={3}>
          New user accounts are created by an administrator.
        </Typography>
      </Paper>
    </Box>
  );
}
