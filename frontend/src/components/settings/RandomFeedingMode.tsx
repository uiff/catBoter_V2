// RandomFeedingMode.tsx - Random Fütterungsmodus mit manuellen Zeitintervallen
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  Snackbar,
  Alert,
  Paper,
  Stack,
  Chip,
  FormControlLabel,
  Checkbox,
  Divider,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  Save as SaveIcon,
  PlayArrow as PlayArrowIcon,
  Shuffle as ShuffleIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import axios from 'axios';
import config from '../../config';

interface RandomPlan {
  planName: string;
  minInterval: number; // in Minuten
  maxInterval: number; // in Minuten
  dailyWeight: number;
  autoGenerate: boolean; // Täglich neu generieren
  workdaysOnly: boolean; // Nur Mo-Fr
  active: boolean;
  type: 'random';
  startTime?: string; // z.B. "06:00"
  endTime?: string; // z.B. "22:00"
  minPause?: number; // Minimale Pause in Minuten
}

const daysOfWeek = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

const RandomFeedingMode: React.FC = () => {
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [savedPlansOpen, setSavedPlansOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [minInterval, setMinInterval] = useState(120); // 2 Stunden
  const [maxInterval, setMaxInterval] = useState(240); // 4 Stunden
  const [dailyWeight, setDailyWeight] = useState(50);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [workdaysOnly, setWorkdaysOnly] = useState(false);
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('22:00');
  const [minPause, setMinPause] = useState(60); // 1 Stunde minimale Pause
  const [savedRandomPlans, setSavedRandomPlans] = useState<RandomPlan[]>([]);
  
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const loadRandomPlans = async () => {
    try {
      const response = await axios.get(`${config.apiBaseUrl}/random_plans`);
      setSavedRandomPlans(response.data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  useEffect(() => {
    loadRandomPlans();
  }, []);

  const calculateEstimatedFeedings = () => {
    const avgInterval = (minInterval + maxInterval) / 2;
    const activeHours = 16; // 6:00 - 22:00
    const activeMinutes = activeHours * 60;
    return Math.floor(activeMinutes / avgInterval);
  };

  const saveRandomPlan = async () => {
    if (!planName.trim()) {
      setSnackbarMessage('Bitte Plan-Namen eingeben');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    if (minInterval < 30) {
      setSnackbarMessage('Minimales Intervall muss mindestens 30 Minuten sein');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    if (maxInterval <= minInterval) {
      setSnackbarMessage('Maximales Intervall muss größer als das Minimum sein');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    try {
      await axios.post(`${config.apiBaseUrl}/random_plan`, {
        planName: planName.trim(),
        minInterval,
        maxInterval,
        dailyWeight,
        autoGenerate,
        workdaysOnly,
        startTime,
        endTime,
        minPause,
        active: false,
        type: 'random'
      });

      setSnackbarMessage('Random Plan gespeichert!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      
      setPlanName('');
      setMinInterval(120);
      setMaxInterval(240);
      setDailyWeight(50);
      setAutoGenerate(true);
      setWorkdaysOnly(false);
      setStartTime('06:00');
      setEndTime('22:00');
      setMinPause(60);
      
      loadRandomPlans();
    } catch (error: any) {
      setSnackbarMessage(error.response?.data?.error || 'Fehler beim Speichern');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const activateRandomPlan = async (plan: RandomPlan) => {
    try {
      await axios.post(`${config.apiBaseUrl}/random_plan/activate`, { 
        planName: plan.planName 
      });
      
      setSnackbarMessage('Random Plan aktiviert!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      loadRandomPlans();
    } catch (error: any) {
      setSnackbarMessage(error.response?.data?.error || 'Fehler beim Aktivieren');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const deleteRandomPlan = async (planName: string) => {
    try {
      await axios.delete(`${config.apiBaseUrl}/random_plan/${encodeURIComponent(planName)}`);
      setSnackbarMessage('Random Plan gelöscht!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      loadRandomPlans();
    } catch (error: any) {
      setSnackbarMessage(error.response?.data?.error || 'Fehler beim Löschen');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const generateNow = async () => {
    try {
      await axios.post(`${config.apiBaseUrl}/random_plan/generate_now`);
      setSnackbarMessage('Neue Random-Zeiten generiert!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error: any) {
      setSnackbarMessage(error.response?.data?.error || 'Fehler beim Generieren');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  return (
    <Stack spacing={3}>
      {/* Neuer Random Plan */}
      <Paper sx={{ p: 4, borderRadius: 1, border: '1px solid rgba(255, 255, 255, 0.08)', background: '#1a1a1a' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: newPlanOpen ? 3 : 0, cursor: 'pointer' }} onClick={() => setNewPlanOpen(!newPlanOpen)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ShuffleIcon sx={{ color: '#8b5cf6', fontSize: 36 }} />
          <Box>
            <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
              Neuer Random Plan
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Zufällige Fütterungszeiten mit Intervallen
            </Typography>
          </Box>
          </Box>
          <IconButton sx={{ color: 'white' }}>
            {newPlanOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={newPlanOpen}>
          <Stack spacing={3}>
          <TextField
            fullWidth
            label="Plan-Name"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder="z.B. Wochentags Random"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&:hover fieldset': { borderColor: '#8b5cf6' },
                '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
              },
              '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)', '&.Mui-focused': { color: '#8b5cf6' } }
            }}
          />

          <Box sx={{ p: 3, borderRadius: 0.5, backgroundColor: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                Zeitintervalle
              </Typography>
              <Tooltip title="Die Fütterungen werden zufällig innerhalb dieser Zeitintervalle generiert">
                <IconButton size="small" sx={{ color: '#8b5cf6' }}>
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Min. Intervall (Minuten)"
                  value={minInterval}
                  onChange={(e) => setMinInterval(Number(e.target.value))}
                  InputProps={{ inputProps: { min: 30, max: 720 } }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: '#8b5cf6' }
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Max. Intervall (Minuten)"
                  value={maxInterval}
                  onChange={(e) => setMaxInterval(Number(e.target.value))}
                  InputProps={{ inputProps: { min: 30, max: 720 } }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: '#8b5cf6' }
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' }
                  }}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="time"
                  label="Startzeit"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: '#8b5cf6' }
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="time"
                  label="Endzeit"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: '#8b5cf6' }
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Min. Pause (Min)"
                  value={minPause}
                  onChange={(e) => setMinPause(Number(e.target.value))}
                  InputProps={{ inputProps: { min: 30, max: 180 } }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: '#8b5cf6' }
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' }
                  }}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 2, p: 2, borderRadius: 1, backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
              <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                ≈ {calculateEstimatedFeedings()} Fütterungen pro Tag (basierend auf {startTime}-{endTime} Uhr)
              </Typography>
            </Box>
          </Box>

          <TextField
            fullWidth
            type="number"
            label="Tagesgewicht (Gramm)"
            value={dailyWeight}
            onChange={(e) => setDailyWeight(Number(e.target.value))}
            InputProps={{ inputProps: { min: 10, max: 500 } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&:hover fieldset': { borderColor: '#8b5cf6' }
              },
              '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' }
            }}
          />

          <Box sx={{ p: 2, borderRadius: 0.5, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={autoGenerate}
                  onChange={(e) => setAutoGenerate(e.target.checked)}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.3)',
                    '&.Mui-checked': { color: '#8b5cf6' }
                  }}
                />
              }
              label={
                <Box>
                  <Typography sx={{ color: 'white', fontWeight: 600 }}>
                    Täglich neue Zeiten generieren
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                    Jeden Tag werden automatisch neue zufällige Fütterungszeiten erstellt
                  </Typography>
                </Box>
              }
            />

            <Divider sx={{ my: 2, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

            <FormControlLabel
              control={
                <Checkbox
                  checked={workdaysOnly}
                  onChange={(e) => setWorkdaysOnly(e.target.checked)}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.3)',
                    '&.Mui-checked': { color: '#8b5cf6' }
                  }}
                />
              }
              label={
                <Box>
                  <Typography sx={{ color: 'white', fontWeight: 600 }}>
                    Nur Wochentags (Mo-Fr)
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                    Random-Modus nur von Montag bis Freitag aktiv
                  </Typography>
                </Box>
              }
            />
          </Box>

          <Button
            variant="contained"
            onClick={saveRandomPlan}
            startIcon={<SaveIcon />}
            sx={{
              py: 1.5,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }
            }}
          >
            Random Plan speichern
          </Button>
          </Stack>
        </Collapse>
      </Paper>

      {/* Random Plan */}
      <Paper sx={{ p: 4, borderRadius: 1, border: '1px solid rgba(255, 255, 255, 0.08)', background: '#1a1a1a' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: savedPlansOpen ? 3 : 0, cursor: 'pointer' }} onClick={() => setSavedPlansOpen(!savedPlansOpen)}>
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ShuffleIcon sx={{ fontSize: 28, color: '#8b5cf6' }} />
            Random Plan
          </Typography>
          <IconButton sx={{ color: 'white' }}>
            {savedPlansOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={savedPlansOpen}>
          {savedRandomPlans.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography sx={{ color: '#cbd5e1' }}>Noch keine Random Pläne erstellt</Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {savedRandomPlans.map((plan, index) => (
              <Grid item xs={12} key={index}>
                <Box sx={{
                  p: 2.5,
                  borderRadius: 0.5,
                  border: plan.active ? '2px solid #8b5cf6' : '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: plan.active ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  transition: 'all 0.2s ease',
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
                        {plan.planName}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip
                          label={`${plan.minInterval}-${plan.maxInterval} Min`}
                          size="small"
                          sx={{
                            backgroundColor: 'rgba(139, 92, 246, 0.2)',
                            color: '#8b5cf6',
                            fontWeight: 700,
                          }}
                        />
                        <Chip
                          label={`${plan.dailyWeight}g/Tag`}
                          size="small"
                          sx={{
                            backgroundColor: 'rgba(6, 182, 212, 0.2)',
                            color: '#06b6d4',
                            fontWeight: 700,
                          }}
                        />
                        {plan.autoGenerate && (
                          <Chip
                            label="Auto-Generierung"
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(76, 175, 80, 0.2)',
                              color: '#4CAF50',
                              fontWeight: 700,
                            }}
                          />
                        )}
                        {plan.workdaysOnly && (
                          <Chip
                            label="Mo-Fr"
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(255, 152, 0, 0.2)',
                              color: '#FF9800',
                              fontWeight: 700,
                            }}
                          />
                        )}
                      </Stack>
                    </Box>
                    
                    <Chip
                      label={plan.active ? 'Aktiv' : 'Inaktiv'}
                      size="small"
                      sx={{
                        backgroundColor: plan.active ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        color: plan.active ? '#4CAF50' : '#94a3b8',
                        border: plan.active ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid rgba(255, 255, 255, 0.2)',
                        fontWeight: 700,
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {!plan.active && (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => activateRandomPlan(plan)}
                        startIcon={<PlayArrowIcon />}
                        sx={{
                          flex: 1,
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                          '&:hover': { background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }
                        }}
                      >
                        Aktivieren
                      </Button>
                    )}
                    {plan.active && (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={generateNow}
                        startIcon={<ShuffleIcon />}
                        sx={{
                          flex: 1,
                          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                          '&:hover': { background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' }
                        }}
                      >
                        Jetzt neu generieren
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => deleteRandomPlan(plan.planName)}
                      sx={{ 
                        flex: plan.active ? 0 : 0, 
                        color: '#F44336', 
                        borderColor: '#F44336', 
                        '&:hover': { borderColor: '#D32F2F', backgroundColor: 'rgba(244, 67, 54, 0.1)' } 
                      }}
                    >
                      Löschen
                    </Button>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
          )}
        </Collapse>
      </Paper>

      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ background: snackbarSeverity === 'success' ? '#4CAF50' : '#F44336', color: 'white' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default RandomFeedingMode;
