// Modern Chart Monitoring Component
import * as React from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { LineChart, lineElementClasses } from '@mui/x-charts/LineChart';
import {
  Box,
  Typography,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Button,
  Slider,
  Alert,
  Chip,
  IconButton,
  Collapse,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import config from '../../config';

interface DataPoint {
  time: string;
  value: number;
}

const metrics = [
  { value: 'distance', label: 'Füllstand (%)', color: '#06b6d4' },
  { value: 'weight', label: 'Gewicht (g)', color: '#4CAF50' },
  { value: 'temperature', label: 'Temperatur (°C)', color: '#FF9800' },
  { value: 'cpu', label: 'CPU (%)', color: '#8b5cf6' },
  { value: 'ram', label: 'RAM (MB)', color: '#F44336' },
  { value: 'disk', label: 'Festplatte (%)', color: '#795548' },
];

const timeRanges = [
  { value: '1h', label: '1 Stunde', subtract: { value: 1, unit: 'hour' } },
  { value: '6h', label: '6 Stunden', subtract: { value: 6, unit: 'hour' } },
  { value: '1d', label: '1 Tag', subtract: { value: 1, unit: 'day' } },
  { value: '3d', label: '3 Tage', subtract: { value: 3, unit: 'day' } },
  { value: '1w', label: '1 Woche', subtract: { value: 7, unit: 'day' } },
];

const ChartMonitoring: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [data, setData] = React.useState<DataPoint[]>([]);
  const [selectedMetric, setSelectedMetric] = React.useState('distance');
  const [selectedRange, setSelectedRange] = React.useState('1d');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);

  const currentMetric = metrics.find(m => m.value === selectedMetric) || metrics[0];

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const end = dayjs().toISOString();
      const range = timeRanges.find((r) => r.value === selectedRange);
      const start = range 
        ? dayjs().subtract(range.subtract.value, range.subtract.unit as dayjs.ManipulateType).toISOString()
        : null;

      const response = await axios.get<DataPoint[]>(`${config.apiBaseUrl}/influx/${selectedMetric}`, {
        params: { start, end },
        timeout: 10000,
      });

      if (!response.data || response.data.length === 0) {
        setError('Keine Daten für den ausgewählten Zeitraum verfügbar');
        setData([]);
        return;
      }

      setData(response.data);
      setLastUpdate(new Date());
      
    } catch (error: any) {
      console.error('Error fetching chart data:', error);
      setError('Fehler beim Laden der Chart-Daten');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMetric, selectedRange]);

  React.useEffect(() => {
    fetchData();
  }, [selectedMetric, selectedRange, fetchData]);

  React.useEffect(() => {
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatValue = (value: number) => {
    if (selectedMetric === 'weight') return `${value.toFixed(1)}g`;
    if (selectedMetric === 'temperature') return `${value.toFixed(1)}°C`;
    if (selectedMetric === 'distance') return `${value.toFixed(0)}%`;
    return value.toFixed(1);
  };

  const getLatestValue = () => {
    if (data.length === 0) return 'N/A';
    return formatValue(data[data.length - 1].value);
  };

  const getTrend = () => {
    if (data.length < 2) return null;
    const latest = data[data.length - 1].value;
    const previous = data[data.length - 2].value;
    const diff = latest - previous;
    
    if (Math.abs(diff) < 0.1) return 'stable';
    return diff > 0 ? 'up' : 'down';
  };

  const trend = getTrend();

  return (
    <Paper 
      sx={{ 
        borderRadius: { xs: 0, sm: 1 },
        overflow: 'hidden',
        border: { xs: 'none', sm: '1px solid rgba(255, 255, 255, 0.08)' },
        borderBottom: { xs: '1px solid rgba(255, 255, 255, 0.05)', sm: '1px solid rgba(255, 255, 255, 0.08)' },
        background: '#1a1a1a',
      }}
    >
      {/* Header */}
      <Box sx={{ 
        p: { xs: 2, sm: 3 },
        borderBottom: { xs: '1px solid rgba(255, 255, 255, 0.05)', sm: '1px solid rgba(255, 255, 255, 0.08)' },
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 48,
              height: 48,
              borderRadius: 0.5,
              background: `rgba(6, 182, 212, 0.15)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(6, 182, 212, 0.3)',
            }}>
              <TrendingUpIcon sx={{ color: '#06b6d4', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                Verlaufsdiagramm
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontSize: { xs: '0.8rem', sm: '0.875rem' }, display: { xs: 'none', sm: 'block' } }}>
                Zeitliche Entwicklung der Messwerte
              </Typography>
            </Box>
          </Box>
          
          <IconButton
            onClick={() => setExpanded(!expanded)}
            sx={{ 
              color: '#cbd5e1',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)' }
            }}
            size="small"
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded} timeout="auto">
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {/* Steuerelemente */}
          <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: { xs: 2, sm: 3 } }}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#94a3b8' }}>Messwert</InputLabel>
                <Select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                  label="Messwert"
                  sx={{
                    backgroundColor: '#0f0f0f',
                    color: 'white',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                  }}
                >
                  {metrics.map((metric) => (
                    <MenuItem key={metric.value} value={metric.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            backgroundColor: metric.color,
                          }}
                        />
                        {metric.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#94a3b8' }}>Zeitraum</InputLabel>
                <Select
                  value={selectedRange}
                  onChange={(e) => setSelectedRange(e.target.value)}
                  label="Zeitraum"
                  sx={{
                    backgroundColor: '#0f0f0f',
                    color: 'white',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                  }}
                >
                  {timeRanges.map((range) => (
                    <MenuItem key={range.value} value={range.value}>
                      {range.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Button
                variant="outlined"
                fullWidth
                onClick={fetchData}
                disabled={loading}
                startIcon={<RefreshIcon />}
                sx={{ 
                  minHeight: '40px',
                  color: '#06b6d4',
                  borderColor: 'rgba(6, 182, 212, 0.3)',
                  '&:hover': {
                    borderColor: 'rgba(6, 182, 212, 0.5)',
                    backgroundColor: 'rgba(6, 182, 212, 0.05)',
                  }
                }}
              >
                {loading ? 'Lädt...' : 'Aktualisieren'}
              </Button>
            </Grid>
          </Grid>

          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                color: '#F44336',
                border: '1px solid rgba(244, 67, 54, 0.3)',
              }}
            >
              {error}
            </Alert>
          )}

          {/* Chart */}
          <Box sx={{ 
            p: { xs: 0, sm: 2 },
            borderRadius: { xs: 0, sm: 2 },
            backgroundColor: { xs: 'transparent', sm: '#0f0f0f' },
            border: { xs: 'none', sm: '1px solid rgba(255, 255, 255, 0.06)' },
            minHeight: { xs: 600, sm: 400 },
            overflow: 'visible',
            mx: { xs: -2, sm: 0 },
          }}>
            {data.length > 0 ? (
              <LineChart
                height={isMobile ? 600 : isTablet ? 500 : 400}
                series={[
                  {
                    data: data.map((d) => d.value),
                    label: currentMetric.label,
                    area: true,
                    showMark: false,
                    curve: 'catmullRom',
                    color: currentMetric.color,
                  },
                ]}
                xAxis={[
                  {
                    data: data.map((d) => new Date(d.time)),
                    scaleType: 'time',
                    label: isMobile ? '' : 'Zeit',
                    tickLabelStyle: {
                      fontSize: isMobile ? 10 : 12,
                      angle: isMobile ? -45 : 0,
                    },
                  },
                ]}
                yAxis={[
                  {
                    label: isMobile ? '' : currentMetric.label,
                    tickLabelStyle: {
                      fontSize: isMobile ? 10 : 12,
                    },
                  },
                ]}
                margin={{ 
                  left: isMobile ? 50 : 70, 
                  right: isMobile ? 10 : 30, 
                  top: isMobile ? 60 : 20, 
                  bottom: isMobile ? 80 : 70 
                }}
                slotProps={{
                  legend: {
                    hidden: isMobile,
                  },
                  popper: {
                    placement: 'top-start',
                    modifiers: [
                      {
                        name: 'offset',
                        options: {
                          offset: [0, isMobile ? -120 : -20],
                        },
                      },
                      {
                        name: 'flip',
                        options: {
                          fallbackPlacements: ['top', 'top-end'],
                        },
                      },
                      {
                        name: 'preventOverflow',
                        options: {
                          padding: 20,
                          boundary: 'viewport',
                          altBoundary: true,
                        },
                      },
                    ],
                    sx: {
                      '& .MuiChartsTooltip-root': {
                        backgroundColor: 'rgba(0, 0, 0, 0.95) !important',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        padding: '12px',
                        fontSize: isMobile ? '14px' : '12px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                      },
                      '& .MuiChartsTooltip-table': {
                        '& td': {
                          padding: '4px 8px',
                          fontSize: isMobile ? '14px' : '12px',
                        },
                      },
                    },
                  },
                }}
                sx={{
                  [`& .${lineElementClasses.root}`]: {
                    display: 'none',
                  },
                  '& .MuiLineElement-root': {
                    strokeWidth: isMobile ? 3 : 2,
                  },
                  '& .MuiAreaElement-root': {
                    fillOpacity: 0.3,
                  },
                  '& .MuiChartsAxis-tickLabel': {
                    fill: '#94a3b8 !important',
                  },
                  '& .MuiChartsAxis-label': {
                    fill: '#cbd5e1 !important',
                    fontSize: isMobile ? '12px' : '14px',
                  },
                  '& .MuiChartsAxis-line': {
                    stroke: 'rgba(255, 255, 255, 0.1) !important',
                  },
                  '& .MuiChartsAxis-tick': {
                    stroke: 'rgba(255, 255, 255, 0.1) !important',
                  },
                  touchAction: 'pan-y',
                }}
              />
            ) : (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="h6" gutterBottom sx={{ color: '#cbd5e1' }}>
                  {loading ? 'Lade Daten...' : 'Keine Daten verfügbar'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  {loading 
                    ? 'Bitte warten Sie einen Moment'
                    : 'Versuchen Sie einen anderen Zeitraum oder Messwert'
                  }
                </Typography>
              </Box>
            )}
          </Box>

          {lastUpdate && (
            <Box sx={{ mt: { xs: 1, sm: 2 }, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                Letzte Aktualisierung: {lastUpdate.toLocaleTimeString('de-DE')}
                {data.length > 0 && ` • ${data.length} Datenpunkte`}
              </Typography>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default ChartMonitoring;
