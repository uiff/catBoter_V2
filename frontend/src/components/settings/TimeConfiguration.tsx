import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Stack,
  Collapse,
  IconButton,
  Chip,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Sync as SyncIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import config from '../../config';

const TimeConfiguration: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [timeMode, setTimeMode] = useState<'ntp' | 'manual'>('ntp');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [manualDate, setManualDate] = useState('');
  const [manualTime, setManualTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [ntpStatus, setNtpStatus] = useState<'synced' | 'not_synced' | 'unknown'>('unknown');

  // Lade aktuelle Zeit und Status
  useEffect(() => {
    loadTimeStatus();
    const interval = setInterval(loadTimeStatus, 5000); // Alle 5 Sekunden aktualisieren
    return () => clearInterval(interval);
  }, []);

  const loadTimeStatus = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/system/time_status`);
      if (response.ok) {
        const data = await response.json();
        setCurrentTime(data.current_time || '');
        setTimeMode(data.ntp_enabled ? 'ntp' : 'manual');
        setNtpStatus(data.ntp_synced ? 'synced' : 'not_synced');
      }
    } catch (error) {
      console.error('Fehler beim Laden des Zeit-Status:', error);
    }
  };

  const handleSaveTime = async () => {
    setLoading(true);
    setMessage(null);

    try {
      if (timeMode === 'ntp') {
        // NTP aktivieren
        const response = await fetch(`${config.apiBaseUrl}/system/enable_ntp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          setMessage({ type: 'success', text: 'NTP-Zeitsynchronisation aktiviert!' });
          loadTimeStatus();
        } else {
          const errorData = await response.json();
          setMessage({ type: 'error', text: errorData.error || 'Fehler beim Aktivieren von NTP' });
        }
      } else {
        // Manuelle Zeit setzen
        if (!manualDate || !manualTime) {
          setMessage({ type: 'error', text: 'Bitte Datum und Uhrzeit eingeben' });
          return;
        }

        const response = await fetch(`${config.apiBaseUrl}/system/set_time`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: manualDate,
            time: manualTime,
          }),
        });

        if (response.ok) {
          setMessage({ type: 'success', text: 'Zeit erfolgreich gesetzt!' });
          loadTimeStatus();
        } else {
          const errorData = await response.json();
          setMessage({ type: 'error', text: errorData.error || 'Fehler beim Setzen der Zeit' });
        }
      }
    } catch (error) {
      console.error('Zeit-Konfigurations-Fehler:', error);
      setMessage({ type: 'error', text: `Fehler: ${error}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${config.apiBaseUrl}/system/sync_ntp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Zeit erfolgreich synchronisiert!' });
        loadTimeStatus();
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || 'Fehler bei der Synchronisation' });
      }
    } catch (error) {
      console.error('NTP-Sync-Fehler:', error);
      setMessage({ type: 'error', text: `Fehler: ${error}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 4, borderRadius: 1, border: '1px solid rgba(255, 255, 255, 0.08)', background: '#1a1a1a' }}>
      {/* Header */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: open ? 3 : 0, 
          cursor: 'pointer' 
        }} 
        onClick={() => setOpen(!open)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 48,
            height: 48,
            borderRadius: 0.5,
            background: 'rgba(139, 92, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }}>
            <AccessTimeIcon sx={{ fontSize: 28, color: '#8b5cf6' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, fontSize: '1.1rem' }}>
              Zeit-Konfiguration
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.85rem' }}>
              {currentTime || 'Lade...'}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={timeMode === 'ntp' ? 'NTP' : 'Manuell'}
            size="small"
            icon={timeMode === 'ntp' ? <SyncIcon sx={{ fontSize: '0.9rem' }} /> : <EditIcon sx={{ fontSize: '0.9rem' }} />}
            sx={{
              backgroundColor: timeMode === 'ntp' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              color: timeMode === 'ntp' ? '#4CAF50' : '#f59e0b',
              border: `1px solid ${timeMode === 'ntp' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              fontWeight: 700,
              height: 24,
              fontSize: '0.7rem',
            }}
          />
          {timeMode === 'ntp' && (
            <Chip
              label={ntpStatus === 'synced' ? 'Sync' : ntpStatus === 'not_synced' ? 'Nicht Sync' : '?'}
              size="small"
              sx={{
                backgroundColor: ntpStatus === 'synced' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: ntpStatus === 'synced' ? '#4CAF50' : '#ef4444',
                border: `1px solid ${ntpStatus === 'synced' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                fontWeight: 700,
                height: 24,
                fontSize: '0.7rem',
              }}
            />
          )}
          <IconButton sx={{ color: 'white' }}>
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={open}>
        <Stack spacing={3}>
          {message && (
            <Alert 
              severity={message.type}
              onClose={() => setMessage(null)}
              sx={{
                backgroundColor: message.type === 'success' ? 'rgba(76, 175, 80, 0.15)' : 
                                message.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                border: `1px solid ${message.type === 'success' ? 'rgba(76, 175, 80, 0.3)' : 
                                    message.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(6, 182, 212, 0.3)'}`,
                color: 'white',
                '& .MuiAlert-icon': {
                  color: message.type === 'success' ? '#4CAF50' : 
                         message.type === 'error' ? '#ef4444' : '#06b6d4'
                }
              }}
            >
              {message.text}
            </Alert>
          )}

          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

          {/* Aktuelle Zeit Anzeige */}
          <Box sx={{ p: 3, borderRadius: 0.5, backgroundColor: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.85rem', mb: 0.5 }}>
                  Aktuelle Systemzeit
                </Typography>
                <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, fontFamily: 'monospace' }}>
                  {currentTime || '--:--:--'}
                </Typography>
              </Box>
              <IconButton onClick={loadTimeStatus} sx={{ color: '#8b5cf6' }}>
                <RefreshIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Zeit-Modus Auswahl */}
          <Box>
            <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
              Zeit-Modus wählen
            </Typography>
            <RadioGroup value={timeMode} onChange={(e) => setTimeMode(e.target.value as 'ntp' | 'manual')}>
              <FormControlLabel
                value="ntp"
                control={<Radio sx={{ color: '#8b5cf6', '&.Mui-checked': { color: '#8b5cf6' } }} />}
                label={
                  <Box>
                    <Typography sx={{ color: 'white', fontWeight: 600 }}>
                      Automatisch (NTP)
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                      Zeit wird automatisch über das Internet synchronisiert (empfohlen)
                    </Typography>
                  </Box>
                }
                sx={{ 
                  p: 2, 
                  mb: 1,
                  borderRadius: 0.5, 
                  backgroundColor: timeMode === 'ntp' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${timeMode === 'ntp' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)'}`,
                  '&:hover': { backgroundColor: 'rgba(139, 92, 246, 0.05)' }
                }}
              />
              <FormControlLabel
                value="manual"
                control={<Radio sx={{ color: '#8b5cf6', '&.Mui-checked': { color: '#8b5cf6' } }} />}
                label={
                  <Box>
                    <Typography sx={{ color: 'white', fontWeight: 600 }}>
                      Manuell
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                      Zeit manuell einstellen (kein Internet erforderlich)
                    </Typography>
                  </Box>
                }
                sx={{ 
                  p: 2,
                  borderRadius: 0.5, 
                  backgroundColor: timeMode === 'manual' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${timeMode === 'manual' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)'}`,
                  '&:hover': { backgroundColor: 'rgba(139, 92, 246, 0.05)' }
                }}
              />
            </RadioGroup>
          </Box>

          {/* NTP Optionen */}
          {timeMode === 'ntp' && (
            <Box sx={{ p: 3, borderRadius: 0.5, backgroundColor: 'rgba(76, 175, 80, 0.05)', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                NTP-Synchronisation
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
                Die Zeit wird automatisch mit NTP-Servern synchronisiert. Dies erfordert eine Internetverbindung.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<SyncIcon />}
                  onClick={handleSyncNow}
                  disabled={loading}
                  sx={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)',
                    '&:hover': { background: 'linear-gradient(135deg, #388E3C 0%, #2E7D32 100%)' }
                  }}
                >
                  Jetzt synchronisieren
                </Button>
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                  onClick={handleSaveTime}
                  disabled={loading}
                  sx={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    '&:hover': { background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }
                  }}
                >
                  NTP aktivieren
                </Button>
              </Stack>
            </Box>
          )}

          {/* Manuelle Zeit-Eingabe */}
          {timeMode === 'manual' && (
            <Box sx={{ p: 3, borderRadius: 0.5, backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                Zeit manuell einstellen
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  type="date"
                  label="Datum"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
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
                <TextField
                  fullWidth
                  type="time"
                  label="Uhrzeit"
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 1 }}
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
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                  onClick={handleSaveTime}
                  disabled={loading || !manualDate || !manualTime}
                  fullWidth
                  sx={{
                    py: 1.5,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    '&:hover': { background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' },
                    '&:disabled': { background: 'rgba(255, 255, 255, 0.1)' }
                  }}
                >
                  Zeit setzen
                </Button>
              </Stack>
            </Box>
          )}

          {/* Info Box */}
          <Box sx={{ p: 2.5, backgroundColor: 'rgba(6, 182, 212, 0.1)', borderRadius: 0.5, border: '1px solid rgba(6, 182, 212, 0.3)' }}>
            <Typography variant="body2" sx={{ color: '#06b6d4', fontSize: '0.85rem', lineHeight: 1.6 }}>
              ⚠️ <strong>Wichtig:</strong> Eine korrekte Systemzeit ist essentiell für die präzise Ausführung der Fütterungszeiten. 
              Bei Internetverbindung wird NTP-Synchronisation empfohlen.
            </Typography>
          </Box>
        </Stack>
      </Collapse>
    </Paper>
  );
};

export default TimeConfiguration;
