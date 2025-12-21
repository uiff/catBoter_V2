// src/components/pages/Monitoring.tsx - Clean & Modern
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Box,
  Container,
  CircularProgress,
  Alert,
  Grid,
  Paper,
  Typography,
  IconButton,
  Stack,
  Chip,
  Collapse,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  LocalDrink as TankIcon,
  Scale as ScaleIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  DeviceThermostat as CpuTempIcon,
  Speed as CpuIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import ChartMonitoring from '../charts/ChartMonitoring';
import config from '../../config';
import '../../styles.css';

interface SensorData {
  distance: number;
  weight: number;
  last_feeding?: string;
  total_consumed_today?: number;
}

interface SystemData {
  cpu?: { cpu_percent: number };
  temperature?: { temperature: number };
  ram?: { total: number; used: number; percent: number };
  disk?: { total: number; used: number; percent: number };
}

const Monitoring: React.FC = () => {
  const [data, setData] = useState<SensorData | null>(null);
  const [systemData, setSystemData] = useState<SystemData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sensorsOpen, setSensorsOpen] = useState(false);
  const [systemOpen, setSystemOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const sensorResponse = await axios.get<SensorData>(`${config.apiBaseUrl}/sensors`);
      setData(sensorResponse.data);
      
      const [cpuRes, tempRes, ramRes, diskRes] = await Promise.allSettled([
        axios.get(`${config.apiBaseUrl}/system/cpu`),
        axios.get(`${config.apiBaseUrl}/system/temperature`),
        axios.get(`${config.apiBaseUrl}/system/ram`),
        axios.get(`${config.apiBaseUrl}/system/disk`)
      ]);

      const newSystemData: SystemData = {};
      if (cpuRes.status === 'fulfilled') newSystemData.cpu = cpuRes.value.data;
      if (tempRes.status === 'fulfilled') newSystemData.temperature = tempRes.value.data;
      if (ramRes.status === 'fulfilled') newSystemData.ram = ramRes.value.data;
      if (diskRes.status === 'fulfilled') newSystemData.disk = diskRes.value.data;
      
      setSystemData(newSystemData);
      setUpdated(new Date());
      setError('');
    } catch {
      setError('Fehler beim Laden der Monitoring-Daten');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getTankStatusInfo = (fillLevel: number) => {
    if (fillLevel > 50) return { text: 'Gut gefüllt', icon: <CheckCircleIcon />, color: '#4CAF50' };
    if (fillLevel > 20) return { text: 'Mittel', icon: <WarningIcon />, color: '#FF9800' };
    return { text: 'Niedrig', icon: <WarningIcon />, color: '#F44336' };
  };

  if (loading && !data) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={60} sx={{ color: '#06b6d4' }} thickness={4} />
          <Typography sx={{ color: '#cbd5e1', mt: 3, fontSize: '1rem', fontWeight: 500 }}>Lade Monitoring-Daten...</Typography>
        </Box>
      </Box>
    );
  }

  if (error && !data) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: '#0a0a0a', px: 0, py: { xs: 2, sm: 4 } }}>
        <Container maxWidth="lg" disableGutters>
          <Alert severity="error" sx={{ mx: { xs: 2, sm: 0 }, background: '#1a1a1a', border: '1px solid rgba(244, 67, 54, 0.3)', color: 'white', borderRadius: 1, '& .MuiAlert-icon': { color: '#F44336' } }}>{error}</Alert>
        </Container>
      </Box>
    );
  }

  const fillLevel = data ? data.distance : 0;
  const tankStatus = data ? getTankStatusInfo(fillLevel) : null;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', px: 0, py: { xs: 0, sm: 5 } }}>
      <Container maxWidth="md" disableGutters sx={{ px: { xs: 0, sm: 3 } }}>
        <Stack spacing={{ xs: 3, sm: 4 }} sx={{ width: '100%' }}>
          {/* Sensor-Metriken - Gruppiert */}
          <Paper sx={{ 
            borderRadius: { xs: 0, sm: 1 }, 
            border: { xs: 'none', sm: '1px solid rgba(255, 255, 255, 0.08)' },
            borderBottom: { xs: '1px solid rgba(255, 255, 255, 0.05)', sm: '1px solid rgba(255, 255, 255, 0.08)' },
            background: '#1a1a1a',
            overflow: 'hidden'
          }}>
            <Box 
              sx={{ 
                p: { xs: 2, sm: 3 },
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                borderBottom: sensorsOpen ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
              }}
              onClick={() => setSensorsOpen(!sensorsOpen)}
            >
              <Typography variant="h5" sx={{ 
                color: 'white', 
                fontWeight: 700, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.5,
                fontSize: { xs: '1.1rem', sm: '1.5rem' }
              }}>
                <ScaleIcon sx={{ fontSize: { xs: 24, sm: 28 }, color: '#06b6d4' }} />
                Sensor-Metriken
              </Typography>
              <IconButton sx={{ color: 'white' }}>
                {sensorsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={sensorsOpen}>
              <Box sx={{ p: { xs: 2, sm: 3 } }}>
            
            <Grid container spacing={{ xs: 1.5, sm: 3 }}>
              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  p: { xs: 2, sm: 2.5 }, 
                  borderRadius: { xs: 1.5, sm: 2 }, 
                  backgroundColor: `${tankStatus?.color}10`, 
                  border: `1px solid ${tankStatus?.color}30`, 
                  transition: 'all 0.2s ease', 
                  minHeight: { xs: '110px', sm: '140px' },
                  '&:hover': { borderColor: `${tankStatus?.color}50`, backgroundColor: `${tankStatus?.color}15` } 
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 1.5, sm: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TankIcon sx={{ fontSize: { xs: 20, sm: 24 }, color: tankStatus?.color }} />
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Füllstand</Typography>
                    </Box>
                    <Chip icon={tankStatus?.icon} label={tankStatus?.text} size="small" sx={{ backgroundColor: `${tankStatus?.color}20`, color: tankStatus?.color, border: `1px solid ${tankStatus?.color}30`, fontWeight: 700, fontSize: { xs: '0.65rem', sm: '0.7rem' }, height: { xs: 20, sm: 22 }, '& .MuiChip-icon': { color: tankStatus?.color, fontSize: { xs: 12, sm: 14 } } }} />
                  </Box>
                  <Typography variant="h3" sx={{ color: tankStatus?.color, fontWeight: 800, fontSize: { xs: '2.5rem', sm: '3rem' }, lineHeight: 1 }}>{fillLevel.toFixed(0)}%</Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  p: { xs: 2, sm: 2.5 }, 
                  borderRadius: { xs: 1.5, sm: 2 }, 
                  backgroundColor: 'rgba(6, 182, 212, 0.1)', 
                  border: '1px solid rgba(6, 182, 212, 0.3)', 
                  transition: 'all 0.2s ease', 
                  minHeight: { xs: '110px', sm: '140px' },
                  '&:hover': { borderColor: 'rgba(6, 182, 212, 0.5)', backgroundColor: 'rgba(6, 182, 212, 0.15)' } 
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 1.5, sm: 2 } }}>
                    <ScaleIcon sx={{ fontSize: { xs: 20, sm: 24 }, color: '#06b6d4' }} />
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Gewicht</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                    <Typography variant="h3" sx={{ color: '#06b6d4', fontWeight: 800, fontSize: { xs: '2.5rem', sm: '3rem' }, lineHeight: 1 }}>{data?.weight?.toFixed(1) || '0.0'}</Typography>
                    <Typography variant="h5" sx={{ color: '#06b6d4', opacity: 0.7, fontWeight: 600, fontSize: { xs: '1rem', sm: '1.2rem' } }}>g</Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  p: { xs: 2, sm: 2.5 }, 
                  borderRadius: { xs: 1.5, sm: 2 }, 
                  backgroundColor: 'rgba(139, 92, 246, 0.1)', 
                  border: '1px solid rgba(139, 92, 246, 0.3)', 
                  transition: 'all 0.2s ease', 
                  minHeight: { xs: '110px', sm: '140px' },
                  '&:hover': { borderColor: 'rgba(139, 92, 246, 0.5)', backgroundColor: 'rgba(139, 92, 246, 0.15)' } 
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 1.5, sm: 2 } }}>
                    <TrendingUpIcon sx={{ fontSize: { xs: 20, sm: 24 }, color: '#8b5cf6' }} />
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Heute ausgegeben</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                    <Typography variant="h3" sx={{ color: '#8b5cf6', fontWeight: 800, fontSize: { xs: '2.5rem', sm: '3rem' }, lineHeight: 1 }}>{data?.total_consumed_today?.toFixed(1) || '0.0'}</Typography>
                    <Typography variant="h5" sx={{ color: '#8b5cf6', opacity: 0.7, fontWeight: 600, fontSize: { xs: '1rem', sm: '1.2rem' } }}>g</Typography>
                  </Box>
                </Box>
              </Grid>
                </Grid>
              </Box>
            </Collapse>
          </Paper>

          {/* Chart Monitoring - Wiederverwendbare Komponente */}
          <Box sx={{ px: { xs: 0, sm: 0 } }}>
            <ChartMonitoring />
          </Box>

          {/* System-Informationen */}
          <Paper sx={{ 
            borderRadius: { xs: 0, sm: 1 }, 
            border: { xs: 'none', sm: '1px solid rgba(255, 255, 255, 0.08)' },
            borderBottom: { xs: '1px solid rgba(255, 255, 255, 0.05)', sm: '1px solid rgba(255, 255, 255, 0.08)' },
            background: '#1a1a1a',
            overflow: 'hidden'
          }}>
            <Box 
              sx={{ 
                p: { xs: 2, sm: 3 },
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                borderBottom: systemOpen ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
              }}
              onClick={() => setSystemOpen(!systemOpen)}
            >
              <Typography variant="h5" sx={{ 
                color: 'white', 
                fontWeight: 700, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.5,
                fontSize: { xs: '1.1rem', sm: '1.5rem' }
              }}>
                <MemoryIcon sx={{ fontSize: { xs: 24, sm: 28 }, color: '#06b6d4' }} />
                System-Informationen
              </Typography>
              <IconButton sx={{ color: 'white' }}>
                {systemOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={systemOpen}>
              <Box sx={{ p: { xs: 2, sm: 3 } }}>
            
            <Grid container spacing={{ xs: 1.5, sm: 3 }}>
              {systemData.cpu && (
                <Grid item xs={6} sm={6} md={3}>
                  <Box sx={{ 
                    p: { xs: 1.5, sm: 2.5 }, 
                    borderRadius: { xs: 1.5, sm: 2 }, 
                    backgroundColor: 'rgba(255, 152, 0, 0.1)', 
                    border: '1px solid rgba(255, 152, 0, 0.3)', 
                    transition: 'all 0.2s ease', 
                    minHeight: { xs: '90px', sm: '120px' },
                    '&:hover': { borderColor: 'rgba(255, 152, 0, 0.5)', backgroundColor: 'rgba(255, 152, 0, 0.15)' } 
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 1, sm: 2 } }}>
                      <CpuIcon sx={{ fontSize: { xs: 18, sm: 24 }, color: '#FF9800' }} />
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>CPU-Last</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography variant="h4" sx={{ color: '#FF9800', fontWeight: 700, fontSize: { xs: '1.8rem', sm: '2.125rem' } }}>{typeof systemData.cpu.cpu_percent === 'number' ? systemData.cpu.cpu_percent.toFixed(1) : '0.0'}</Typography>
                      <Typography variant="body1" sx={{ color: '#FF9800', opacity: 0.8, fontSize: { xs: '0.875rem', sm: '1rem' } }}>%</Typography>
                    </Box>
                  </Box>
                </Grid>
              )}

              {systemData.temperature && (
                <Grid item xs={6} sm={6} md={3}>
                  <Box sx={{ 
                    p: { xs: 1.5, sm: 2.5 }, 
                    borderRadius: { xs: 1.5, sm: 2 }, 
                    backgroundColor: 'rgba(244, 67, 54, 0.1)', 
                    border: '1px solid rgba(244, 67, 54, 0.3)', 
                    transition: 'all 0.2s ease', 
                    minHeight: { xs: '90px', sm: '120px' },
                    '&:hover': { borderColor: 'rgba(244, 67, 54, 0.5)', backgroundColor: 'rgba(244, 67, 54, 0.15)' } 
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 1, sm: 2 } }}>
                      <CpuTempIcon sx={{ fontSize: { xs: 18, sm: 24 }, color: '#F44336' }} />
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>CPU-Temp</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography variant="h4" sx={{ color: '#F44336', fontWeight: 700, fontSize: { xs: '1.8rem', sm: '2.125rem' } }}>{systemData.temperature.temperature?.toFixed(1) || '0.0'}</Typography>
                      <Typography variant="body1" sx={{ color: '#F44336', opacity: 0.8, fontSize: { xs: '0.875rem', sm: '1rem' } }}>°C</Typography>
                    </Box>
                  </Box>
                </Grid>
              )}

              {systemData.ram && (
                <Grid item xs={6} sm={6} md={3}>
                  <Box sx={{ 
                    p: { xs: 1.5, sm: 2.5 }, 
                    borderRadius: { xs: 1.5, sm: 2 }, 
                    backgroundColor: 'rgba(139, 92, 246, 0.1)', 
                    border: '1px solid rgba(139, 92, 246, 0.3)', 
                    transition: 'all 0.2s ease', 
                    minHeight: { xs: '90px', sm: '120px' },
                    '&:hover': { borderColor: 'rgba(139, 92, 246, 0.5)', backgroundColor: 'rgba(139, 92, 246, 0.15)' } 
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 1, sm: 2 } }}>
                      <MemoryIcon sx={{ fontSize: { xs: 18, sm: 24 }, color: '#8b5cf6' }} />
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>RAM</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography variant="h4" sx={{ color: '#8b5cf6', fontWeight: 700, fontSize: { xs: '1.8rem', sm: '2.125rem' } }}>{systemData.ram.percent?.toFixed(0) || '0'}</Typography>
                      <Typography variant="body1" sx={{ color: '#8b5cf6', opacity: 0.8, fontSize: { xs: '0.875rem', sm: '1rem' } }}>%</Typography>
                    </Box>
                  </Box>
                </Grid>
              )}

              {systemData.disk && (
                <Grid item xs={6} sm={6} md={3}>
                  <Box sx={{ 
                    p: { xs: 1.5, sm: 2.5 }, 
                    borderRadius: { xs: 1.5, sm: 2 }, 
                    backgroundColor: 'rgba(6, 182, 212, 0.1)', 
                    border: '1px solid rgba(6, 182, 212, 0.3)', 
                    transition: 'all 0.2s ease', 
                    minHeight: { xs: '90px', sm: '120px' },
                    '&:hover': { borderColor: 'rgba(6, 182, 212, 0.5)', backgroundColor: 'rgba(6, 182, 212, 0.15)' } 
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 1, sm: 2 } }}>
                      <StorageIcon sx={{ fontSize: { xs: 18, sm: 24 }, color: '#06b6d4' }} />
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Speicher</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography variant="h4" sx={{ color: '#06b6d4', fontWeight: 700, fontSize: { xs: '1.8rem', sm: '2.125rem' } }}>{systemData.disk.percent?.toFixed(0) || '0'}</Typography>
                      <Typography variant="body1" sx={{ color: '#06b6d4', opacity: 0.8, fontSize: { xs: '0.875rem', sm: '1rem' } }}>%</Typography>
                    </Box>
                  </Box>
                </Grid>
              )}
                </Grid>
              </Box>
            </Collapse>
          </Paper>

          {/* Letzte Aktivität */}
          {data?.last_feeding && (
            <Paper sx={{ 
              p: { xs: 2, sm: 3 }, 
              borderRadius: { xs: 0, sm: 1 }, 
              border: { xs: 'none', sm: '1px solid rgba(255, 255, 255, 0.08)' },
              background: '#1a1a1a', 
              transition: 'all 0.2s ease', 
              '&:hover': { borderColor: 'rgba(255, 255, 255, 0.12)', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)' } 
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  width: { xs: 40, sm: 48 }, 
                  height: { xs: 40, sm: 48 }, 
                  borderRadius: 0.5, 
                  background: 'rgba(6, 182, 212, 0.15)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  border: '1px solid rgba(6, 182, 212, 0.3)' 
                }}>
                  <ScheduleIcon sx={{ fontSize: { xs: 24, sm: 28 }, color: '#06b6d4' }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.1rem' } }}>Letzte Fütterung</Typography>
                  <Typography variant="body1" sx={{ color: '#cbd5e1', mt: 0.5, fontSize: { xs: '0.875rem', sm: '1rem' } }}>{new Date(data.last_feeding).toLocaleString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Typography>
                </Box>
              </Box>
            </Paper>
          )}
        </Stack>
      </Container>
      
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Box>
  );
};

export default Monitoring;
