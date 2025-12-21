import React, { useState, useEffect, lazy, Suspense } from 'react';
import { styled, ThemeProvider } from '@mui/material/styles';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import RefreshIcon from '@mui/icons-material/Refresh';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import TuneIcon from '@mui/icons-material/Tune';
import InfoIcon from '@mui/icons-material/Info';
import PetsIcon from '@mui/icons-material/Pets';
import { Box, useMediaQuery, CircularProgress } from '@mui/material';
import { theme } from './theme';
import BackendStatus from './components/BackendStatus';
import './styles.css';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./components/pages/Dashboard'));
const Monitoring = lazy(() => import('./components/pages/Monitoring'));
const Konfiguration = lazy(() => import('./components/pages/Konfiguration'));
const Einstellungen = lazy(() => import('./components/pages/Einstellungen'));
const About = lazy(() => import('./components/pages/About'));

// Loading component
const LoadingFallback = () => (
  <Box sx={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    minHeight: 'calc(100vh - 64px)',
    backgroundColor: '#0a0a0a'
  }}>
    <CircularProgress size={60} sx={{ color: '#06b6d4' }} />
  </Box>
);

const drawerWidth = 280;

// Styled Components
const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
  open?: boolean;
}>(({ theme, open }) => ({
  flexGrow: 1,
  padding: 0,
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: `-${drawerWidth}px`,
  minHeight: '100vh',
  background: 'transparent',
  ...(open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: 0,
  }),
  [theme.breakpoints.down('md')]: {
    marginLeft: 0,
  },
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 2),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-start',
  gap: theme.spacing(2),
}));

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: drawerWidth,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: drawerWidth,
    boxSizing: 'border-box',
    background: '#0f0f0f',
    border: 'none',
    borderRight: '1px solid rgba(255, 255, 255, 0.06)',
    color: 'white',
  },
}));

const StyledAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<{ open?: boolean }>(({ theme, open }) => ({
  background: '#0a0a0a',
  boxShadow: 'none',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
  [theme.breakpoints.down('md')]: {
    width: '100%',
    marginLeft: 0,
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
}));

// Navigation Items
const navigationItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Monitoring', icon: <BarChartIcon />, path: '/monitoring' },
  { text: 'Konfiguration', icon: <TuneIcon />, path: '/konfiguration' },
  { text: 'Einstellungen', icon: <SettingsIcon />, path: '/einstellungen' },
  { text: 'About', icon: <InfoIcon />, path: '/about' },
];

function AppContent() {
  const [open, setOpen] = useState(false);
  const [backendOnline, setBackendOnline] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width:960px)');

  useEffect(() => {
    // Desktop: Drawer standardmäßig geöffnet
    if (!isMobile) {
      setOpen(true);
    }
  }, [isMobile]);

  const handleBackendStatusChange = (isOnline: boolean) => {
    setBackendOnline(isOnline);
    console.log('Backend Status:', isOnline ? 'Online' : 'Offline');
  };

  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setOpen(false);
    }
  };

  const getCurrentPageTitle = () => {
    const currentItem = navigationItems.find(item => item.path === location.pathname);
    return currentItem ? currentItem.text : 'Dashboard';
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      
      {/* Backend Status Monitor */}
      <BackendStatus onStatusChange={handleBackendStatusChange} />
      
      {/* App Bar */}
      <StyledAppBar position="fixed" open={open && !isMobile}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{ 
              mr: 2,
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              }
            }}
          >
            <MenuIcon />
          </IconButton>
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontWeight: 600,
              color: 'white',
              fontSize: { xs: '1.1rem', sm: '1.25rem' }
            }}
          >
            {getCurrentPageTitle()}
          </Typography>
          <IconButton
            color="inherit"
            aria-label="refresh"
            onClick={handleRefresh}
            disabled={isRefreshing}
            sx={{ 
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              }
            }}
          >
            <RefreshIcon sx={{ 
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
            }} />
          </IconButton>
        </Toolbar>
      </StyledAppBar>

      {/* Drawer */}
      <StyledDrawer
        variant={isMobile ? "temporary" : "persistent"}
        anchor="left"
        open={open}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '85%', sm: drawerWidth },
            maxWidth: { xs: 320, sm: drawerWidth },
          },
        }}
      >
        <DrawerHeader>
          <PetsIcon sx={{ fontSize: 36, color: '#06b6d4' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.4rem', color: 'white', letterSpacing: '-0.01em' }}>
              catBoter
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.5, color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>
              Smart Cat Feeder
            </Typography>
          </Box>
        </DrawerHeader>
        
        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)', my: 2 }} />
        
        <List sx={{ px: { xs: 1.5, sm: 2 }, py: 2 }}>
          {navigationItems.map((item) => (
            <ListItem key={item.text} disablePadding sx={{ mb: { xs: 0.5, sm: 1 } }}>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  borderRadius: { xs: 2, sm: 3 },
                  py: { xs: 1.8, sm: 1.5 },
                  px: { xs: 2, sm: 2 },
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    '&:hover': {
                      backgroundColor: 'rgba(6, 182, 212, 0.2)',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ 
                  color: location.pathname === item.path ? '#06b6d4' : '#94a3b8', 
                  minWidth: { xs: 40, sm: 44 },
                  '& svg': { fontSize: { xs: 24, sm: 26 } }
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  sx={{ 
                    '& .MuiTypography-root': { 
                      fontWeight: location.pathname === item.path ? 700 : 500,
                      fontSize: { xs: '0.9rem', sm: '0.95rem' },
                      color: location.pathname === item.path ? 'white' : '#cbd5e1',
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        {/* Footer */}
        <Box sx={{ 
          mt: 'auto', 
          p: 3, 
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          textAlign: 'center'
        }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>
            © 2024 iotueli
          </Typography>
        </Box>
      </StyledDrawer>

      {/* Main Content */}
      <Main open={open && !isMobile}>
        <DrawerHeader sx={{ minHeight: { xs: 56, sm: 64 } }} />
        <Box sx={{ minHeight: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)' } }}>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/monitoring" element={<Monitoring />} />
              <Route path="/konfiguration" element={<Konfiguration />} />
              <Route path="/einstellungen" element={<Einstellungen />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </Suspense>
        </Box>
      </Main>
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Router>
        <div className="App" style={{ 
          minHeight: '100vh',
          background: '#0a0a0a',
        }}>
          <AppContent />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
