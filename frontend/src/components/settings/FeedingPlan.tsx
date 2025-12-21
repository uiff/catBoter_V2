// FeedingPlan.tsx - Modern Dashboard Style mit Trennung & Collapse
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  IconButton,
  Snackbar,
  Alert,
  Paper,
  Collapse,
  Stack,
  Chip,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Save as SaveIcon,
  PlayArrow as PlayArrowIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import axios from 'axios';
import config from '../../config';

const daysOfWeek = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const daysFull = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

interface FeedingTime {
  time: string;
  weight: number;
}

interface FeedingPlan {
  planName: string;
  selectedDays: string[];
  feedingSchedule: { [key: string]: FeedingTime[] };
  active: boolean;
  weightMode?: 'manual' | 'daily' | 'automatic';
  dailyWeight?: number;
}

const FeedingPlan: React.FC = () => {
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [savedPlansOpen, setSavedPlansOpen] = useState(false);
  
  const [planName, setPlanName] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [feedingSchedule, setFeedingSchedule] = useState<{ [key: string]: FeedingTime[] }>({});
  const [savedPlans, setSavedPlans] = useState<FeedingPlan[]>([]);
  
  // Neue Felder für Tagesgewicht-Modus
  const [weightMode, setWeightMode] = useState<'manual' | 'daily'>('manual');
  const [dailyWeight, setDailyWeight] = useState<number>(50);
  const [feedingsPerDay, setFeedingsPerDay] = useState<number>(3);
  
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const loadPlans = useCallback(async () => {
    try {
      const response = await axios.get(`${config.apiBaseUrl}/feeding_plan`);
      // Sortiere: Aktiver Plan zuoberst
      const sorted = response.data.sort((a: FeedingPlan, b: FeedingPlan) => {
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        return 0;
      });
      setSavedPlans(sorted);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleDayToggle = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const addFeedingTime = (day: string) => {
    if (weightMode === 'daily') {
      // Im daily-Modus: Gewicht automatisch verteilen
      const currentFeedings = feedingSchedule[day] || [];
      const newCount = currentFeedings.length + 1;
      const weightPerFeeding = dailyWeight / newCount;
      
      // Aktualisiere bestehende Fütterungen mit neuem Gewicht
      const updatedFeedings = currentFeedings.map(feeding => ({
        ...feeding,
        weight: weightPerFeeding
      }));
      
      // Füge neue Fütterung hinzu
      setFeedingSchedule(prev => ({
        ...prev,
        [day]: [...updatedFeedings, { time: '12:00', weight: weightPerFeeding }]
      }));
    } else {
      // Manueller Modus
      setFeedingSchedule(prev => ({
        ...prev,
        [day]: [...(prev[day] || []), { time: '12:00', weight: 50 }]
      }));
    }
  };

  const removeFeedingTime = (day: string, index: number) => {
    if (weightMode === 'daily') {
      // Im daily-Modus: Gewicht neu verteilen
      const remainingFeedings = feedingSchedule[day].filter((_, i) => i !== index);
      if (remainingFeedings.length > 0) {
        const weightPerFeeding = dailyWeight / remainingFeedings.length;
        setFeedingSchedule(prev => ({
          ...prev,
          [day]: remainingFeedings.map(feeding => ({
            ...feeding,
            weight: weightPerFeeding
          }))
        }));
      } else {
        setFeedingSchedule(prev => ({
          ...prev,
          [day]: []
        }));
      }
    } else {
      // Manueller Modus
      setFeedingSchedule(prev => ({
        ...prev,
        [day]: prev[day].filter((_, i) => i !== index)
      }));
    }
  };

  const updateTime = (day: string, index: number, time: string) => {
    setFeedingSchedule(prev => {
      const newSchedule = { ...prev };
      newSchedule[day][index].time = time;
      return newSchedule;
    });
  };

  const updateWeight = (day: string, index: number, weight: number) => {
    setFeedingSchedule(prev => {
      const newSchedule = { ...prev };
      newSchedule[day][index].weight = weight;
      return newSchedule;
    });
  };

  const savePlan = async () => {
    if (!planName.trim()) {
      setSnackbarMessage('Bitte Plan-Namen eingeben');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    if (selectedDays.length === 0) {
      setSnackbarMessage('Bitte mindestens einen Tag wählen');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    try {
      await axios.post(`${config.apiBaseUrl}/feeding_plan`, {
        planName: planName.trim(),
        selectedDays: selectedDays.map(d => daysFull[daysOfWeek.indexOf(d)]),
        feedingSchedule: Object.fromEntries(
          Object.entries(feedingSchedule).map(([day, times]) => [
            daysFull[daysOfWeek.indexOf(day)],
            times
          ])
        ),
        weightMode: weightMode,
        dailyWeight: weightMode === 'daily' ? dailyWeight : undefined,
        active: false
      });

      setSnackbarMessage('Plan gespeichert!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      
      setPlanName('');
      setSelectedDays([]);
      setFeedingSchedule({});
      setWeightMode('manual');
      setDailyWeight(50);
      setFeedingsPerDay(3);
      setNewPlanOpen(false);
      loadPlans();
    } catch (error) {
      setSnackbarMessage('Fehler beim Speichern');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const activatePlan = async (plan: string) => {
    try {
      await axios.post(`${config.apiBaseUrl}/feeding_plan/load`, { planName: plan });
      setSnackbarMessage('Plan aktiviert!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      loadPlans();
    } catch (error) {
      setSnackbarMessage('Fehler beim Aktivieren');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const deletePlan = async (plan: string) => {
    try {
      await axios.delete(`${config.apiBaseUrl}/feeding_plan/${encodeURIComponent(plan)}`);
      setSnackbarMessage('Plan gelöscht!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      loadPlans();
    } catch (error) {
      setSnackbarMessage('Fehler beim Löschen');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  return (
    <Stack spacing={3}>
      {/* Neuer Plan erstellen */}
      <Paper sx={{ p: 4, borderRadius: 1, border: '1px solid rgba(255, 255, 255, 0.08)', background: '#1a1a1a' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: newPlanOpen ? 3 : 0, cursor: 'pointer' }} onClick={() => setNewPlanOpen(!newPlanOpen)}>
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CalendarIcon sx={{ fontSize: 28, color: '#06b6d4' }} />
            Neuer Plan erstellen
          </Typography>
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
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                  '&:hover fieldset': { borderColor: '#06b6d4' },
                  '&.Mui-focused fieldset': { borderColor: '#06b6d4' }
                },
                '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)', '&.Mui-focused': { color: '#06b6d4' } }
              }}
            />

            <Box>
              <Typography variant="body1" sx={{ color: 'white', mb: 2, fontWeight: 600 }}>Gewicht-Modus</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant={weightMode === 'manual' ? 'contained' : 'outlined'}
                    onClick={() => setWeightMode('manual')}
                    sx={{
                      minHeight: 56,
                      fontSize: '0.9rem',
                      ...(weightMode === 'manual' ? {
                        background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                        '&:hover': { background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' }
                      } : {
                        color: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        '&:hover': { borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.1)' }
                      })
                    }}
                  >
                    Manuell
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant={weightMode === 'daily' ? 'contained' : 'outlined'}
                    onClick={() => setWeightMode('daily')}
                    sx={{
                      minHeight: 56,
                      fontSize: '0.9rem',
                      ...(weightMode === 'daily' ? {
                        background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                        '&:hover': { background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' }
                      } : {
                        color: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        '&:hover': { borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.1)' }
                      })
                    }}
                  >
                    Tagesgewicht
                  </Button>
                </Grid>
              </Grid>
            </Box>

            {weightMode === 'daily' && (
              <Box sx={{ p: 2, borderRadius: 0.5, backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 2 }}>
                  Gib das maximale Tagesgewicht ein. Es wird automatisch gleichmäßig auf alle Fütterungen verteilt.
                </Typography>
                <TextField
                  fullWidth
                  type="number"
                  label="Tagesgewicht (Gramm)"
                  value={dailyWeight}
                  onChange={(e) => {
                    const newWeight = Number(e.target.value);
                    setDailyWeight(newWeight);
                    // Gewicht neu verteilen für alle Tage
                    const updatedSchedule = { ...feedingSchedule };
                    Object.keys(updatedSchedule).forEach(day => {
                      const count = updatedSchedule[day].length;
                      if (count > 0) {
                        const weightPerFeeding = newWeight / count;
                        updatedSchedule[day] = updatedSchedule[day].map(feeding => ({
                          ...feeding,
                          weight: weightPerFeeding
                        }));
                      }
                    });
                    setFeedingSchedule(updatedSchedule);
                  }}
                  InputProps={{ inputProps: { min: 10, max: 500 } }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: '#06b6d4' }
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' }
                  }}
                />
              </Box>
            )}

            <Box>
              <Typography variant="body1" sx={{ color: 'white', mb: 2, fontWeight: 600 }}>Tage wählen</Typography>
              <Grid container spacing={1}>
                {daysOfWeek.map((day) => (
                  <Grid item xs={12/7} key={day}>
                    <Button
                      fullWidth
                      variant={selectedDays.includes(day) ? 'contained' : 'outlined'}
                      onClick={() => handleDayToggle(day)}
                      sx={{
                        minHeight: 56,
                        fontSize: '0.9rem',
                        ...(selectedDays.includes(day) ? {
                          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                          '&:hover': { background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' }
                        } : {
                          color: 'white',
                          borderColor: 'rgba(255, 255, 255, 0.2)',
                          '&:hover': { borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.1)' }
                        })
                      }}
                    >
                      {day}
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </Box>

            {selectedDays.map((day) => (
              <Box key={day} sx={{ p: 2, borderRadius: 0.5, backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>{day}</Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => addFeedingTime(day)}
                    sx={{ color: '#06b6d4' }}
                  >
                    Fütterung
                  </Button>
                </Box>

                <Stack spacing={2}>
                  {(feedingSchedule[day] || []).map((feeding, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <TextField
                        type="time"
                        value={feeding.time}
                        onChange={(e) => updateTime(day, index, e.target.value)}
                        sx={{
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            color: 'white',
                            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                            '&:hover fieldset': { borderColor: '#06b6d4' }
                          }
                        }}
                      />
                      <TextField
                        type="number"
                        label="Gramm"
                        value={feeding.weight.toFixed(1)}
                        onChange={(e) => updateWeight(day, index, Number(e.target.value))}
                        InputProps={{ inputProps: { min: 1, max: 500 } }}
                        disabled={weightMode === 'daily'}
                        sx={{
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            color: 'white',
                            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                            '&:hover fieldset': { borderColor: '#06b6d4' }
                          },
                          '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' }
                        }}
                      />
                      <IconButton onClick={() => removeFeedingTime(day, index)} sx={{ color: '#F44336' }}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}

            <Button
              variant="contained"
              onClick={savePlan}
              startIcon={<SaveIcon />}
              sx={{
                py: 1.5,
                background: 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #388E3C 0%, #689F38 100%)' }
              }}
            >
              Plan speichern
            </Button>
          </Stack>
        </Collapse>
      </Paper>

      {/* Gespeicherte Pläne */}
      <Paper sx={{ p: 4, borderRadius: 1, border: '1px solid rgba(255, 255, 255, 0.08)', background: '#1a1a1a' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: savedPlansOpen ? 3 : 0, cursor: 'pointer' }} onClick={() => setSavedPlansOpen(!savedPlansOpen)}>
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ScheduleIcon sx={{ fontSize: 28, color: '#06b6d4' }} />
            Gespeicherte Pläne
          </Typography>
          <IconButton sx={{ color: 'white' }}>
            {savedPlansOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={savedPlansOpen}>
          {savedPlans.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: '#cbd5e1' }}>Noch keine Pläne erstellt</Typography>
            </Box>
          ) : (
            <Grid container spacing={2} justifyContent="center" sx={{ maxWidth: { xs: '100%', sm: '100%' }, mx: 'auto' }}>
              {savedPlans.map((plan, index) => {
                // Berechne Gesamtzahl der Fütterungen
                const totalFeedings = Object.values(plan.feedingSchedule).reduce((sum: number, feedings: any[]) => sum + feedings.length, 0);
                
                return (
                  <Grid item xs={12} sm={6} key={index} sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Box sx={{
                      p: 2.5,
                      borderRadius: 0.5,
                      border: plan.active ? '2px solid #4CAF50' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: plan.active ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                      transition: 'all 0.2s ease',
                      '&:hover': { borderColor: plan.active ? '#4CAF50' : 'rgba(255, 255, 255, 0.2)' }
                    }}>
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>{plan.planName}</Typography>
                      
                      <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
                        {plan.selectedDays.map((day: string) => (
                          <Chip
                            key={day}
                            label={day.substring(0, 2)}
                            size="small"
                            sx={{
                              backgroundColor: plan.active ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                              color: plan.active ? '#4CAF50' : 'white',
                              fontWeight: 700,
                              fontSize: '0.75rem'
                            }}
                          />
                        ))}
                      </Box>

                      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                        <Chip
                          icon={plan.active ? <CheckCircleIcon /> : <ScheduleIcon />}
                          label={plan.active ? 'Aktiv' : 'Inaktiv'}
                          size="small"
                          sx={{
                            backgroundColor: plan.active ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                            color: plan.active ? '#4CAF50' : '#94a3b8',
                            border: plan.active ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid rgba(255, 255, 255, 0.2)',
                            fontWeight: 700,
                            '& .MuiChip-icon': { color: plan.active ? '#4CAF50' : '#94a3b8' }
                          }}
                        />
                        <Chip
                          label={`${totalFeedings} Fütterungen`}
                          size="small"
                          sx={{
                            backgroundColor: 'rgba(6, 182, 212, 0.2)',
                            color: '#06b6d4',
                            fontWeight: 700,
                            fontSize: '0.75rem'
                          }}
                        />
                        {plan.weightMode === 'daily' && plan.dailyWeight && (
                          <Chip
                            label={`${plan.dailyWeight}g/Tag`}
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(255, 152, 0, 0.2)',
                              color: '#FF9800',
                              fontWeight: 700,
                              fontSize: '0.75rem'
                            }}
                          />
                        )}
                      </Stack>

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {!plan.active && (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => activatePlan(plan.planName)}
                            startIcon={<PlayArrowIcon />}
                            sx={{
                              flex: 1,
                              background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                              '&:hover': { background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' }
                            }}
                          >
                            Laden & Aktivieren
                          </Button>
                        )}
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => deletePlan(plan.planName)}
                          sx={{ 
                            flex: plan.active ? 1 : 0, 
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
                );
              })}
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

export default FeedingPlan;
