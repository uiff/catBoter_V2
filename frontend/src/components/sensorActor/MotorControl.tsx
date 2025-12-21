// MotorControl.tsx - Modern Dashboard Style
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Button,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Box,
  Grid,
  Chip,
  Snackbar,
  Alert,
  useMediaQuery,
  Fab,
  useTheme,
  Paper,
  Stack,
  Divider,
  TextField,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  PanTool as HandIcon,
  RotateRight as RotateRightIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Error as ErrorIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Scale as ScaleIcon,
  RocketLaunch as RocketIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import config from '../../config';

interface FeedingTime {
  day: string;
  time: { time: string; sound: boolean; weight: number; status: boolean | null };
}

const MotorControl: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  
  const [motorRunning, setMotorRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<string>(() => localStorage.getItem('motorMode') || 'automatic');
  const [feedingTimes, setFeedingTimes] = useState<FeedingTime[]>([]);
  const [planName, setPlanName] = useState<string>('');
  const [weight, setWeight] = useState<number | null>(null);
  const [openSnackbar, setOpenSnackbar] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  
  // Random-Modus States
  const [randomDailyWeight, setRandomDailyWeight] = useState<number>(50);
  const [randomFeedingCount, setRandomFeedingCount] = useState<number>(3);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const touchStartRef = useRef<number>(0);
  const touchEndRef = useRef<number>(0);
  const isHoldingRef = useRef<boolean>(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchWeight = useCallback(async () => {
    try {
      const response = await axios.get<{ weight: number }>(`${config.apiBaseUrl}/weight`);
      setWeight(response.data.weight);
    } catch (error) {
      console.error('Error fetching weight:', error);
    }
  }, []);

  useEffect(() => {
    const fetchFeedingPlan = async () => {
      try {
        const response = await axios.get(`${config.apiBaseUrl}/feeding_plan`);
        const activePlan = response.data.find((plan: any) => plan.active);
        if (activePlan) {
          setPlanName(activePlan.planName);
          const currentTime = new Date();
          const currentDay = currentTime.toLocaleString('de-DE', { weekday: 'long' });
          const allTimes = Object.entries(activePlan.feedingSchedule)
            .flatMap(([day, times]: [string, any]) => times.map((time: any) => ({ day, time })))
            .filter(feedingTime => feedingTime.day === currentDay);
          allTimes.sort((a: FeedingTime, b: FeedingTime) => {
            const timeA = new Date(`${currentTime.toDateString()} ${a.time.time}`).getTime();
            const timeB = new Date(`${currentTime.toDateString()} ${b.time.time}`).getTime();
            return timeA - timeB;
          });
          setFeedingTimes(allTimes);
        }
      } catch (error) {
        console.error('Error fetching feeding plan:', error);
      }
    };
    fetchFeedingPlan();
  }, []);

  useEffect(() => {
    fetchWeight();
    const interval = setInterval(fetchWeight, 5000);
    return () => clearInterval(interval);
  }, [fetchWeight]);

  useEffect(() => {
    localStorage.setItem('motorMode', mode);
  }, [mode]);

  const handleMotorStart = async () => {
    if (loading || motorRunning) return;
    setLoading(true);
    try {
      await axios.post(`${config.apiBaseUrl}/motor`, { action: 'rotate' });
      setMotorRunning(true);
      setSnackbarMessage('Motor gestartet');
      setSnackbarSeverity('success');
      setOpenSnackbar(true);
    } catch (error) {
      setSnackbarMessage('Fehler beim Starten des Motors');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
    } finally {
      setLoading(false);
    }
  };

  const handleMotorStop = async () => {
    if (loading || !motorRunning) return;
    setLoading(true);
    try {
      await axios.post(`${config.apiBaseUrl}/motor`, { action: 'stop' });
      setMotorRunning(false);
      setSnackbarMessage('Motor gestoppt');
      setSnackbarSeverity('success');
      setOpenSnackbar(true);
    } catch (error) {
      setSnackbarMessage('Fehler beim Stoppen des Motors');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
    } finally {
      setLoading(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (mode !== 'manual') return;
    e.preventDefault();
    isHoldingRef.current = true;
    touchStartRef.current = Date.now();
    setTimeout(() => {
      if (isHoldingRef.current && !motorRunning) handleMotorStart();
    }, 100);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (mode !== 'manual') return;
    e.preventDefault();
    isHoldingRef.current = false;
    touchEndRef.current = Date.now();
    if (motorRunning) handleMotorStop();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'manual') return;
    e.preventDefault();
    isHoldingRef.current = true;
    touchStartRef.current = Date.now();
    setTimeout(() => {
      if (isHoldingRef.current && !motorRunning) handleMotorStart();
    }, 100);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (mode !== 'manual') return;
    e.preventDefault();
    isHoldingRef.current = false;
    touchEndRef.current = Date.now();
    if (motorRunning) handleMotorStop();
  };

  const handleModeChange = (event: React.MouseEvent<HTMLElement>, newMode: string) => {
    if (newMode !== null) {
      setMode(newMode);
      if (motorRunning) handleMotorStop();
    }
  };

  const getStatusIcon = (feedingTime: FeedingTime) => {
    if (feedingTime.time.status === true) return <CheckCircleIcon sx={{ fontSize: 18 }} />;
    if (feedingTime.time.status === false) return <ErrorIcon sx={{ fontSize: 18 }} />;
    return <ScheduleIcon sx={{ fontSize: 18 }} />;
  };

  const getStatusInfo = (status: boolean | null) => {
    if (status === true) return { label: 'Erfolgreich', color: '#4CAF50' };
    if (status === false) return { label: 'Fehler', color: '#F44336' };
    return { label: 'Ausstehend', color: '#94a3b8' };
  };

  const generateRandomFeedingPlan = async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    try {
      const response = await axios.post(`${config.apiBaseUrl}/feeding_plan/generate_random`, {
        dailyWeight: randomDailyWeight,
        feedingCount: randomFeedingCount
      });
      
      setSnackbarMessage('Random Fütterungsplan erfolgreich erstellt!');
      setSnackbarSeverity('success');
      setOpenSnackbar(true);
      
      // Reload feeding times
      const plansResponse = await axios.get(`${config.apiBaseUrl}/feeding_plan`);
      const activePlan = plansResponse.data.find((plan: any) => plan.active);
      if (activePlan) {
        setPlanName(activePlan.planName);
        const currentTime = new Date();
        const currentDay = currentTime.toLocaleString('de-DE', { weekday: 'long' });
        const allTimes = Object.entries(activePlan.feedingSchedule)
          .flatMap(([day, times]: [string, any]) => times.map((time: any) => ({ day, time })))
          .filter(feedingTime => feedingTime.day === currentDay);
        allTimes.sort((a: FeedingTime, b: FeedingTime) => {
          const timeA = new Date(`${currentTime.toDateString()} ${a.time.time}`).getTime();
          const timeB = new Date(`${currentTime.toDateString()} ${b.time.time}`).getTime();
          return timeA - timeB;
        });
        setFeedingTimes(allTimes);
      }
    } catch (error) {
      setSnackbarMessage('Fehler beim Erstellen des Random Plans');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Paper sx={{ 
      p: { xs: 2, sm: 4 }, 
      borderRadius: { xs: 0, sm: 1 }, 
      border: { xs: 'none', sm: '1px solid rgba(255, 255, 255, 0.08)' },
      borderBottom: { xs: '1px solid rgba(255, 255, 255, 0.05)', sm: '1px solid rgba(255, 255, 255, 0.08)' },
      background: '#1a1a1a' 
    }}>
      <Typography variant="h5" sx={{ 
        color: 'white', 
        fontWeight: 700, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5, 
        mb: { xs: 2, sm: 3 },
        fontSize: { xs: '1.1rem', sm: '1.5rem' }
      }}>
        <RocketIcon sx={{ fontSize: { xs: 24, sm: 28 }, color: '#06b6d4' }} />
        Futter-Steuerung
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 3, sm: 4 } }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          sx={{
            gap: { xs: 1, sm: 1.5 },
            '& .MuiToggleButtonGroup-grouped': {
              border: 0,
              borderRadius: '12px !important',
              '&:not(:first-of-type)': {
                marginLeft: 0,
              },
            },
          }}
        >
          <ToggleButton 
            value="automatic"
            sx={{
              minWidth: { xs: 90, sm: 110 },
              px: { xs: 2, sm: 3 },
              py: { xs: 1.5, sm: 2 },
              borderRadius: 1,
              border: '2px solid rgba(255, 255, 255, 0.1) !important',
              backgroundColor: mode === 'automatic' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              transition: 'all 0.3s ease',
              '&.Mui-selected': {
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                border: '2px solid #4CAF50 !important',
                boxShadow: '0 0 20px rgba(76, 175, 80, 0.3)',
                '&:hover': { 
                  backgroundColor: 'rgba(76, 175, 80, 0.25)',
                }
              },
              '&:hover': { 
                backgroundColor: mode === 'automatic' ? 'rgba(76, 175, 80, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                transform: 'translateY(-2px)',
              }
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <SettingsIcon sx={{ 
                fontSize: { xs: 28, sm: 32 }, 
                color: mode === 'automatic' ? '#4CAF50' : '#94a3b8',
                transition: 'all 0.3s ease',
              }} />
              <Typography 
                variant="button" 
                sx={{ 
                  fontSize: { xs: '0.7rem', sm: '0.85rem' },
                  fontWeight: mode === 'automatic' ? 700 : 600,
                  color: mode === 'automatic' ? '#4CAF50' : '#cbd5e1',
                  transition: 'all 0.3s ease',
                }}
              >
                Auto
              </Typography>
            </Box>
          </ToggleButton>

          <ToggleButton 
            value="random"
            sx={{
              minWidth: { xs: 90, sm: 110 },
              px: { xs: 2, sm: 3 },
              py: { xs: 1.5, sm: 2 },
              borderRadius: 1,
              border: '2px solid rgba(255, 255, 255, 0.1) !important',
              backgroundColor: mode === 'random' ? 'rgba(255, 152, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              transition: 'all 0.3s ease',
              '&.Mui-selected': {
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                border: '2px solid #FF9800 !important',
                boxShadow: '0 0 20px rgba(255, 152, 0, 0.3)',
                '&:hover': { 
                  backgroundColor: 'rgba(255, 152, 0, 0.25)',
                }
              },
              '&:hover': { 
                backgroundColor: mode === 'random' ? 'rgba(255, 152, 0, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                transform: 'translateY(-2px)',
              }
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <RocketIcon sx={{ 
                fontSize: { xs: 28, sm: 32 }, 
                color: mode === 'random' ? '#FF9800' : '#94a3b8',
                transition: 'all 0.3s ease',
              }} />
              <Typography 
                variant="button" 
                sx={{ 
                  fontSize: { xs: '0.7rem', sm: '0.85rem' },
                  fontWeight: mode === 'random' ? 700 : 600,
                  color: mode === 'random' ? '#FF9800' : '#cbd5e1',
                  transition: 'all 0.3s ease',
                }}
              >
                Random
              </Typography>
            </Box>
          </ToggleButton>

          <ToggleButton 
            value="manual"
            sx={{
              minWidth: { xs: 90, sm: 110 },
              px: { xs: 2, sm: 3 },
              py: { xs: 1.5, sm: 2 },
              borderRadius: 1,
              border: '2px solid rgba(255, 255, 255, 0.1) !important',
              backgroundColor: mode === 'manual' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              transition: 'all 0.3s ease',
              '&.Mui-selected': {
                backgroundColor: 'rgba(6, 182, 212, 0.2)',
                border: '2px solid #06b6d4 !important',
                boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
                '&:hover': { 
                  backgroundColor: 'rgba(6, 182, 212, 0.25)',
                }
              },
              '&:hover': { 
                backgroundColor: mode === 'manual' ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                transform: 'translateY(-2px)',
              }
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <HandIcon sx={{ 
                fontSize: { xs: 28, sm: 32 }, 
                color: mode === 'manual' ? '#06b6d4' : '#94a3b8',
                transition: 'all 0.3s ease',
              }} />
              <Typography 
                variant="button" 
                sx={{ 
                  fontSize: { xs: '0.7rem', sm: '0.85rem' },
                  fontWeight: mode === 'manual' ? 700 : 600,
                  color: mode === 'manual' ? '#06b6d4' : '#cbd5e1',
                  transition: 'all 0.3s ease',
                }}
              >
                Manuell
              </Typography>
            </Box>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Divider sx={{ my: { xs: 2, sm: 3 }, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

      {mode === 'automatic' && (
        <Stack spacing={{ xs: 2, sm: 3 }}>
          <Box sx={{ 
            p: { xs: 2, sm: 3 }, 
            borderRadius: { xs: 1.5, sm: 2 }, 
            backgroundColor: 'rgba(6, 182, 212, 0.1)', 
            border: '1px solid rgba(6, 182, 212, 0.3)', 
            textAlign: 'center' 
          }}>
            <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Aktivierter Fütterungsplan</Typography>
            <Typography variant="h6" sx={{ color: '#06b6d4', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.25rem' } }}>{planName || 'Kein Plan aktiv'}</Typography>
          </Box>

          {feedingTimes.length > 0 ? (
            <Box sx={{ maxWidth: '100%' }}>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' }, textAlign: 'center' }}>Heutige Fütterungen</Typography>
              <Grid container spacing={{ xs: 1.5, sm: 2 }} justifyContent="center" sx={{ maxWidth: { xs: '100%', sm: '600px' }, mx: 'auto' }}>
                {feedingTimes.map((feedingTime, index) => {
                  const statusInfo = getStatusInfo(feedingTime.time.status);
                  return (
                    <Grid item xs={12} sm={6} key={index} sx={{ display: 'flex', justifyContent: 'center' }}>
                      <Box sx={{ 
                        p: { xs: 2, sm: 2.5 }, 
                        borderRadius: { xs: 1.5, sm: 2 }, 
                        border: `1px solid ${statusInfo.color}30`, 
                        backgroundColor: `${statusInfo.color}10`, 
                        transition: 'all 0.2s ease',
                        textAlign: 'center',
                        width: '100%',
                        maxWidth: { xs: '400px', sm: '100%' },
                        mx: 'auto',
                        '&:hover': { borderColor: `${statusInfo.color}50` } 
                      }}>
                        <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, mb: 1, fontSize: { xs: '1.3rem', sm: '1.5rem' } }}>{feedingTime.time.time}</Typography>
                        <Typography variant="h6" sx={{ color: '#06b6d4', fontWeight: 600, mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>{feedingTime.time.weight.toFixed(1)} g</Typography>
                        <Chip
                          icon={getStatusIcon(feedingTime)}
                          label={statusInfo.label}
                          size="small"
                          sx={{
                            backgroundColor: `${statusInfo.color}20`,
                            color: statusInfo.color,
                            border: `1px solid ${statusInfo.color}40`,
                            fontWeight: 700,
                            fontSize: { xs: '0.7rem', sm: '0.75rem' },
                            height: { xs: 24, sm: 28 },
                            '& .MuiChip-icon': { color: statusInfo.color, fontSize: { xs: 16, sm: 18 } }
                          }}
                        />
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          ) : (
            <Box sx={{ 
              p: { xs: 3, sm: 4 }, 
              borderRadius: { xs: 1.5, sm: 2 }, 
              backgroundColor: 'rgba(244, 67, 54, 0.1)', 
              border: '1px solid rgba(244, 67, 54, 0.3)', 
              textAlign: 'center' 
            }}>
              <ErrorIcon sx={{ fontSize: { xs: 40, sm: 48 }, color: '#F44336', mb: 2 }} />
              <Typography variant="h6" sx={{ color: 'white', mb: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>Keine Fütterungen für heute</Typography>
              <Typography variant="body2" sx={{ color: '#cbd5e1', fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Konfigurieren Sie einen Plan</Typography>
            </Box>
          )}
        </Stack>
      )}

      {mode === 'random' && (
        <Stack spacing={{ xs: 2, sm: 3 }}>
          {feedingTimes.length > 0 ? (
            <Box sx={{ maxWidth: '100%' }}>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' }, textAlign: 'center' }}>Heutige Fütterungen</Typography>
              <Grid container spacing={{ xs: 1.5, sm: 2 }} justifyContent="center" sx={{ maxWidth: '100%', mx: 'auto' }}>
                {feedingTimes.map((feedingTime, index) => {
                  const statusInfo = getStatusInfo(feedingTime.time.status);
                  return (
                    <Grid item xs={12} sm={6} key={index}>
                      <Box sx={{ 
                        p: 2.5, 
                        borderRadius: 0.5, 
                        border: `1px solid ${statusInfo.color}30`, 
                        backgroundColor: `${statusInfo.color}10`, 
                        transition: 'all 0.2s ease',
                        textAlign: 'center',
                        '&:hover': { borderColor: `${statusInfo.color}50` } 
                      }}>
                        <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>{feedingTime.time.time}</Typography>
                        <Typography variant="h6" sx={{ color: '#06b6d4', fontWeight: 600, mb: 2 }}>{feedingTime.time.weight.toFixed(1)} g</Typography>
                        <Chip
                          icon={getStatusIcon(feedingTime)}
                          label={statusInfo.label}
                          size="small"
                          sx={{
                            backgroundColor: `${statusInfo.color}20`,
                            color: statusInfo.color,
                            border: `1px solid ${statusInfo.color}40`,
                            fontWeight: 700,
                            '& .MuiChip-icon': { color: statusInfo.color }
                          }}
                        />
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          ) : (
            <Box sx={{ 
              p: { xs: 3, sm: 4 }, 
              borderRadius: { xs: 1.5, sm: 2 }, 
              backgroundColor: 'rgba(255, 152, 0, 0.1)', 
              border: '1px solid rgba(255, 152, 0, 0.3)', 
              textAlign: 'center' 
            }}>
              <RocketIcon sx={{ fontSize: { xs: 48, sm: 56 }, color: '#FF9800', mb: 2 }} />
              <Typography variant="h6" sx={{ color: 'white', mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                Kein Random Plan aktiv
              </Typography>
              <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 3, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                Erstelle einen Random Fütterungsplan in der Konfiguration
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/konfiguration')}
                endIcon={<ArrowForwardIcon />}
                sx={{
                  py: 1.5,
                  px: 4,
                  background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
                  '&:hover': { 
                    background: 'linear-gradient(135deg, #F57C00 0%, #E65100 100%)',
                    transform: 'translateY(-2px)',
                  }
                }}
              >
                Zur Konfiguration
              </Button>
            </Box>
          )}
        </Stack>
      )}

      {mode === 'manual' && (
        <Stack spacing={{ xs: 2, sm: 3 }}>
          <Box sx={{ 
            p: { xs: 2, sm: 3 }, 
            borderRadius: { xs: 1.5, sm: 2 }, 
            backgroundColor: 'rgba(6, 182, 212, 0.1)', 
            border: '1px solid rgba(6, 182, 212, 0.3)' 
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 1.5, sm: 2 } }}>
              <ScaleIcon sx={{ fontSize: { xs: 28, sm: 32 }, color: '#06b6d4' }} />
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 0.5, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Aktuelles Gewicht</Typography>
                <Typography variant="h4" sx={{ color: '#06b6d4', fontWeight: 700, fontSize: { xs: '1.8rem', sm: '2.125rem' } }}>{weight !== null ? `${weight.toFixed(1)} g` : '---'}</Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ 
            p: { xs: 3, sm: 4 }, 
            borderRadius: { xs: 1.5, sm: 2 }, 
            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
            textAlign: 'center' 
          }}>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>Motor Steuerung</Typography>
            <Typography variant="body2" sx={{ color: '#cbd5e1', mb: { xs: 2, sm: 3 }, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
              {isMobile ? 'Halten Sie den Button gedrückt' : 'Halten Sie die Maustaste gedrückt'}
            </Typography>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 1.5, sm: 2 } }}>
              {isMobile ? (
                <Fab
                  ref={fabRef}
                  size="large"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  disabled={loading}
                  sx={{
                    width: { xs: 100, sm: 120 },
                    height: { xs: 100, sm: 120 },
                    background: motorRunning ? 'linear-gradient(135deg, #F44336 0%, #E91E63 100%)' : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                    '&:hover': { background: motorRunning ? 'linear-gradient(135deg, #D32F2F 0%, #C2185B 100%)' : 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' },
                    '&.Mui-disabled': { backgroundColor: 'rgba(255, 255, 255, 0.2)' }
                  }}
                >
                  {loading ? <CircularProgress size={40} sx={{ color: 'white' }} /> : motorRunning ? <StopIcon sx={{ fontSize: { xs: 40, sm: 48 } }} /> : <PlayArrowIcon sx={{ fontSize: { xs: 40, sm: 48 } }} />}
                </Fab>
              ) : (
                <Button
                  ref={buttonRef}
                  variant="contained"
                  size="large"
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={24} /> : motorRunning ? <RotateRightIcon sx={{ animation: 'spin 1s linear infinite' }} /> : <PlayArrowIcon />}
                  sx={{
                    minWidth: 200,
                    minHeight: 80,
                    background: motorRunning ? 'linear-gradient(135deg, #F44336 0%, #E91E63 100%)' : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                    '&:hover': { background: motorRunning ? 'linear-gradient(135deg, #D32F2F 0%, #C2185B 100%)' : 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' }
                  }}
                >
                  {motorRunning ? 'Motor läuft...' : 'Motor starten'}
                </Button>
              )}
            </Box>
            
            <Chip
              icon={motorRunning ? <RotateRightIcon /> : <StopIcon />}
              label={motorRunning ? 'Motor läuft' : 'Motor gestoppt'}
              sx={{
                backgroundColor: motorRunning ? 'rgba(244, 67, 54, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                color: motorRunning ? '#F44336' : 'white',
                border: motorRunning ? '1px solid rgba(244, 67, 54, 0.4)' : '1px solid rgba(255, 255, 255, 0.2)',
                fontWeight: 700,
                '& .MuiChip-icon': { color: motorRunning ? '#F44336' : 'white', ...(motorRunning && { animation: 'spin 1s linear infinite' }) }
              }}
            />
          </Box>
        </Stack>
      )}

      <Snackbar open={openSnackbar} autoHideDuration={4000} onClose={() => setOpenSnackbar(false)}>
        <Alert onClose={() => setOpenSnackbar(false)} severity={snackbarSeverity} sx={{ background: snackbarSeverity === 'success' ? '#4CAF50' : '#F44336', color: 'white' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
      
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Paper>
  );
};

export default MotorControl;
