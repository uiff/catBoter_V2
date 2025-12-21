// src/components/pages/Dashboard.tsx
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Box,
  Container,
  CircularProgress,
  Alert,
  Paper,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Chip,
  LinearProgress,
  IconButton,
} from '@mui/material';
import {
  LocalDrink as TankIcon,
  Scale as ScaleIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import MotorControl from '../sensorActor/MotorControl';
import config from '../../config';
import '../../styles.css';

interface SensorData {
  distance: number;
  weight: number;
  total_consumed_today?: number;
  last_feeding?: string;
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lowAlert, setLowAlert] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Zeitstempel für letzte Bestätigung und Snooze im LocalStorage
  const getLastAcknowledge = () => {
    const ts = localStorage.getItem('catbot_lastAcknowledge');
    return ts ? parseInt(ts, 10) : 0;
  };
  const setLastAcknowledge = (timestamp: number) => {
    localStorage.setItem('catbot_lastAcknowledge', timestamp.toString());
    localStorage.removeItem('catbot_snoozedUntil'); // Snooze aufheben
  };
  
  const getSnoozedUntil = () => {
    const ts = localStorage.getItem('catbot_snoozedUntil');
    return ts ? parseInt(ts, 10) : 0;
  };
  const setSnoozedUntil = (timestamp: number) => {
    localStorage.setItem('catbot_snoozedUntil', timestamp.toString());
  };

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await axios.get<SensorData>(`${config.apiBaseUrl}/sensors`, { timeout: 10000 });
      setData(res.data);
      setError('');
      // Prüfe, ob Alert angezeigt werden soll
      const fillLevel = res.data.distance;
      const now = Date.now();
      const lastAck = getLastAcknowledge();
      const snoozedUntil = getSnoozedUntil();
      
      // Zeige Alert nur wenn:
      // 1. Füllstand unter 10%
      // 2. Mehr als 1 Stunde seit letzter Bestätigung
      // 3. Snooze-Zeit ist abgelaufen
      if (fillLevel < 10 && (now - lastAck > 3600000) && now > snoozedUntil) {
        setLowAlert(true);
      } else {
        setLowAlert(false);
      }
    } catch {
      setError('Fehler beim Laden der Sensordaten');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const acknowledge = () => {
    setLowAlert(false);
    setLastAcknowledge(Date.now());
  };
  const snooze = () => {
    setLowAlert(false);
    // Speichere Snooze-Zeitstempel (1 Stunde in der Zukunft)
    const snoozeUntil = Date.now() + 3600000; // 1 Stunde
    setSnoozedUntil(snoozeUntil);
  };

  const getTankStatusInfo = (fillLevel: number) => {
    if (fillLevel > 50) return { text: 'Gut gefüllt', icon: <CheckCircleIcon />, color: '#4CAF50' };
    if (fillLevel > 20) return { text: 'Mittel', icon: <WarningIcon />, color: '#FF9800' };
    return { text: 'Niedrig', icon: <WarningIcon />, color: '#F44336' };
  };

  // Hilfsfunktion für Fütterungsstatus
  const getFeedingStatusInfo = (status: boolean | null | undefined) => {
    if (status === true) {
      return { label: 'Erfolgreich', color: '#4CAF50', icon: <CheckCircleIcon /> };
    } else if (status === false) {
      return { label: 'Fehler', color: '#F44336', icon: <WarningIcon /> };
    }
    return { label: 'Geplant', color: '#21CBF3', icon: <ScheduleIcon /> };
  };

  if (loading && !data) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a' 
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={60} sx={{ color: '#06b6d4' }} thickness={4} />
          <Typography sx={{ color: '#cbd5e1', mt: 3, fontSize: '1rem', fontWeight: 500 }}>
            Lade Dashboard-Daten...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (error && !data) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        px: 0,
        py: { xs: 2, sm: 4 }
      }}>
        <Container maxWidth="lg" disableGutters>
          <Alert 
            severity="error" 
            sx={{ 
              mx: { xs: 2, sm: 0 },
              background: '#1a1a1a',
              border: '1px solid rgba(244, 67, 54, 0.3)',
              color: 'white',
              borderRadius: 1,
              '& .MuiAlert-icon': { color: '#F44336' }
            }}
          >
            {error}
          </Alert>
        </Container>
      </Box>
    );
  }

  const tankStatus = data ? getTankStatusInfo(data.distance) : null;
  const fillLevel = data ? data.distance : 0;

  return (
    <Box sx={{ 
      minHeight: '100vh',
      bgcolor: '#0a0a0a',
      px: 0,
      py: { xs: 0, sm: 5 }
    }}>
      <Container maxWidth="md" disableGutters sx={{ px: { xs: 0, sm: 3 } }}>
        <Stack spacing={{ xs: 3, sm: 4 }} sx={{ width: '100%' }}>
          {/* Status-Karten Grid - 3 minimalistische Kacheln */}
          <Grid container spacing={{ xs: 2, sm: 3 }} justifyContent="center">
            {/* Futtertank - mit blinkendem Rahmen bei Warnung */}
            <Grid item xs={4} sm={4}>
              <Paper
                sx={{
                  p: { xs: 2, sm: 3 },
                  borderRadius: { xs: 0, sm: 1 },
                  border: fillLevel < 10 
                    ? { xs: 'none', sm: `2px solid ${tankStatus?.color}` }
                    : { xs: 'none', sm: '1px solid rgba(255, 255, 255, 0.08)' },
                  borderBottom: { xs: '1px solid rgba(255, 255, 255, 0.05)', sm: fillLevel < 10 ? `2px solid ${tankStatus?.color}` : '1px solid rgba(255, 255, 255, 0.08)' },
                  background: '#1a1a1a',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: { xs: 140, sm: 180 },
                  transition: 'all 0.3s ease',
                  animation: fillLevel < 10 ? 'pulse 2s ease-in-out infinite' : 'none',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 8px 24px ${tankStatus?.color}20`,
                  },
                }}
              >
                <TankIcon sx={{ 
                  fontSize: { xs: 48, sm: 64 }, 
                  color: tankStatus?.color,
                  mb: 2
                }} />
                
                <Typography variant="h2" sx={{ 
                  color: tankStatus?.color,
                  fontWeight: 800,
                  fontSize: { xs: '2.5rem', sm: '3.5rem' },
                  lineHeight: 1,
                  mb: 0.5
                }}>
                  {fillLevel.toFixed(0)}%
                </Typography>
                
                <Typography variant="caption" sx={{ 
                  color: '#64748b',
                  fontSize: { xs: '0.7rem', sm: '0.8rem' },
                  textAlign: 'center'
                }}>
                  Futtertank
                </Typography>
              </Paper>
            </Grid>

            {/* Futterschale */}
            <Grid item xs={4} sm={4}>
              <Paper
                sx={{
                  p: { xs: 2, sm: 3 },
                  borderRadius: { xs: 0, sm: 1 },
                  border: { xs: 'none', sm: '1px solid rgba(255, 255, 255, 0.08)' },
                  borderBottom: { xs: '1px solid rgba(255, 255, 255, 0.05)', sm: '1px solid rgba(255, 255, 255, 0.08)' },
                  background: '#1a1a1a',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: { xs: 140, sm: 180 },
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(6, 182, 212, 0.2)',
                  },
                }}
              >
                <ScaleIcon sx={{ 
                  fontSize: { xs: 48, sm: 64 }, 
                  color: '#06b6d4',
                  mb: 2
                }} />
                
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                  <Typography variant="h2" sx={{ 
                    color: '#06b6d4',
                    fontWeight: 800,
                    fontSize: { xs: '2.5rem', sm: '3.5rem' },
                    lineHeight: 1,
                  }}>
                    {data?.weight.toFixed(1)}
                  </Typography>
                  <Typography variant="h5" sx={{ 
                    color: '#06b6d4',
                    opacity: 0.7,
                    fontWeight: 600,
                    fontSize: { xs: '1rem', sm: '1.5rem' }
                  }}>
                    g
                  </Typography>
                </Box>
                
                <Typography variant="caption" sx={{ 
                  color: '#64748b',
                  fontSize: { xs: '0.7rem', sm: '0.8rem' },
                  textAlign: 'center',
                  mt: 0.5
                }}>
                  Futterschale
                </Typography>
              </Paper>
            </Grid>

            {/* Heute ausgegeben */}
            <Grid item xs={4} sm={4}>
              <Paper
                sx={{
                  p: { xs: 2, sm: 3 },
                  borderRadius: { xs: 0, sm: 1 },
                  border: { xs: 'none', sm: '1px solid rgba(255, 255, 255, 0.08)' },
                  borderBottom: { xs: '1px solid rgba(255, 255, 255, 0.05)', sm: '1px solid rgba(255, 255, 255, 0.08)' },
                  background: '#1a1a1a',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: { xs: 140, sm: 180 },
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(139, 92, 246, 0.2)',
                  },
                }}
              >
                <TrendingUpIcon sx={{ 
                  fontSize: { xs: 48, sm: 64 }, 
                  color: '#8b5cf6',
                  mb: 2
                }} />
                
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                  <Typography variant="h2" sx={{ 
                    color: '#8b5cf6',
                    fontWeight: 800,
                    fontSize: { xs: '2.5rem', sm: '3.5rem' },
                    lineHeight: 1,
                  }}>
                    {data?.total_consumed_today?.toFixed(1) || '0.0'}
                  </Typography>
                  <Typography variant="h5" sx={{ 
                    color: '#8b5cf6',
                    opacity: 0.7,
                    fontWeight: 600,
                    fontSize: { xs: '1rem', sm: '1.5rem' }
                  }}>
                    g
                  </Typography>
                </Box>
                
                <Typography variant="caption" sx={{ 
                  color: '#64748b',
                  fontSize: { xs: '0.7rem', sm: '0.8rem' },
                  textAlign: 'center',
                  mt: 0.5
                }}>
                  Heute ausgegeben
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Motor Control */}
          <Box sx={{ px: { xs: 0, sm: 0 } }}>
            <MotorControl />
          </Box>
        </Stack>

        {/* Low Alert Dialog */}
        <Dialog 
          open={lowAlert} 
          onClose={snooze}
          PaperProps={{
            sx: {
              backgroundColor: '#1a1a1a',
              backgroundImage: 'none',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 1,
              minWidth: { xs: '90%', sm: 400 }
            }
          }}
        >
          <DialogTitle sx={{ 
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            fontSize: '1.3rem',
            fontWeight: 700
          }}>
            <WarningIcon sx={{ color: '#F44336', fontSize: 32 }} />
            Futterstand niedrig
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.6 }}>
              Der Füllstand liegt unter 10%. Bitte Futtertank nachfüllen.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0, gap: 1 }}>
            <Button 
              onClick={snooze} 
              sx={{ 
                color: '#cbd5e1',
                fontWeight: 600,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }
              }}
            >
              In 1 Stunde erinnern
            </Button>
            <Button 
              onClick={acknowledge} 
              variant="contained"
              sx={{
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                fontWeight: 700,
                px: 3,
                '&:hover': {
                  background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
                  transform: 'translateY(-1px)',
                }
              }}
            >
              Wurde nachgefüllt
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
      
      {/* CSS für Animationen */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          @keyframes pulse {
            0%, 100% {
              border-color: rgba(244, 67, 54, 0.3);
              box-shadow: 0 0 0 0 rgba(244, 67, 54, 0);
            }
            50% {
              border-color: rgba(244, 67, 54, 1);
              box-shadow: 0 0 20px 5px rgba(244, 67, 54, 0.4);
            }
          }
        `}
      </style>
    </Box>
  );
};

export default Dashboard;
