// WeightConfigComponent.tsx - Modern Dashboard Style
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Box,
  TextField,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
  Paper,
  Stack,
  Collapse,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Scale as ScaleIcon,
  Tune as TuneIcon,
  CheckCircle as CheckCircleIcon,
  HelpOutline as HelpIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import axios from 'axios';
import config from '../../config';

const WeightConfigComponent: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState<number | null>(null);
  const [knownWeight, setKnownWeight] = useState('');
  const [calibrationDate, setCalibrationDate] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({
    open: false,
    msg: '',
    sev: 'success',
  });
  const [loadingCal, setLoadingCal] = useState(false);
  const [loadingTare, setLoadingTare] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

  const fetchWeight = useCallback(async () => {
    try {
      const { data } = await axios.get<{ weight: number }>(`${config.apiBaseUrl}/weight`);
      setWeight(Math.round(data.weight * 2) / 2);
    } catch {
      setSnackbar({ open: true, msg: 'Fehler beim Abrufen des Gewichts', sev: 'error' });
    }
  }, []);

  useEffect(() => {
    const iv = setInterval(fetchWeight, 1000);
    fetchWeight();
    return () => clearInterval(iv);
  }, [fetchWeight]);

  const handleCal = async () => {
    setLoadingCal(true);
    try {
      await axios.post(`${config.apiBaseUrl}/weight/calibrate`, { known_weight: parseFloat(knownWeight) });
      setSnackbar({ open: true, msg: 'Kalibrierung erfolgreich', sev: 'success' });
      setCalibrationDate(new Date().toLocaleString('de-DE'));
      setKnownWeight('');
    } catch {
      setSnackbar({ open: true, msg: 'Fehler bei der Kalibrierung', sev: 'error' });
    } finally {
      setLoadingCal(false);
    }
  };

  const handleTare = async () => {
    setLoadingTare(true);
    try {
      await axios.post(`${config.apiBaseUrl}/weight/tare`);
      setSnackbar({ open: true, msg: 'Tarierung erfolgreich', sev: 'success' });
    } catch {
      setSnackbar({ open: true, msg: 'Fehler bei der Tarierung', sev: 'error' });
    } finally {
      setLoadingTare(false);
    }
  };

  return (
    <>
      <Paper sx={{ p: 4, borderRadius: 1, border: '1px solid rgba(255, 255, 255, 0.08)', background: '#1a1a1a' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: open ? 3 : 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
            <ScaleIcon sx={{ fontSize: 28, color: '#06b6d4' }} />
            <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
              Waagen-Kalibrierung
            </Typography>
            <IconButton 
              size="small" 
              onClick={(e) => { e.stopPropagation(); setHelpDialogOpen(true); }}
              sx={{ color: '#06b6d4', '&:hover': { backgroundColor: 'rgba(6, 182, 212, 0.1)' } }}
            >
              <HelpIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
            <Typography variant="h6" sx={{ color: '#06b6d4', fontWeight: 700 }}>
              {weight !== null ? `${weight.toFixed(1)} g` : <CircularProgress size={20} sx={{ color: '#06b6d4' }} />}
            </Typography>
            <IconButton sx={{ color: 'white' }}>
              {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={open}>
          <Stack spacing={3}>
            {/* Aktuelles Gewicht */}
            <Box sx={{ p: 3, borderRadius: 0.5, backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1 }}>Aktuelles Gewicht</Typography>
              <Typography variant="h2" sx={{ color: '#06b6d4', fontWeight: 800, fontSize: '3.5rem', lineHeight: 1 }}>
                {weight !== null ? weight.toFixed(1) : '---'}
              </Typography>
              <Typography variant="h5" sx={{ color: '#06b6d4', opacity: 0.7, fontWeight: 600 }}>Gramm</Typography>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            {/* Kalibrierung */}
            <Box>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TuneIcon sx={{ fontSize: 24, color: '#06b6d4' }} />
                Kalibrierung
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  type="number"
                  label="Bekanntes Gewicht (g)"
                  value={knownWeight}
                  onChange={e => setKnownWeight(e.target.value)}
                  placeholder="z.B. 100"
                  InputProps={{ inputProps: { min: 1, max: 1000 } }}
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
                <Button
                  variant="contained"
                  onClick={handleCal}
                  disabled={loadingCal || !knownWeight}
                  startIcon={loadingCal ? <CircularProgress size={20} /> : <TuneIcon />}
                  fullWidth
                  sx={{
                    py: 1.5,
                    background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                    '&:hover': { background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' },
                    '&:disabled': { background: 'rgba(255, 255, 255, 0.1)' }
                  }}
                >
                  {loadingCal ? 'Kalibriere...' : 'Kalibrieren'}
                </Button>
                {calibrationDate && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, p: 2, borderRadius: 0.5, backgroundColor: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
                    <CheckCircleIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
                    <Typography variant="body2" sx={{ color: 'white' }}>
                      Letzte Kalibrierung: {calibrationDate}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            {/* Tarierung */}
            <Box>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScaleIcon sx={{ fontSize: 24, color: '#06b6d4' }} />
                Tarierung
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ p: 2, borderRadius: 0.5, backgroundColor: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)' }}>
                  <Typography variant="body2" sx={{ color: '#cbd5e1', textAlign: 'center' }}>
                    Entfernen Sie alle Gegenstände von der Waage und drücken Sie "Tarieren"
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  onClick={handleTare}
                  disabled={loadingTare}
                  startIcon={loadingTare ? <CircularProgress size={20} /> : <ScaleIcon />}
                  fullWidth
                  sx={{
                    py: 1.5,
                    background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                    '&:hover': { background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' },
                    '&:disabled': { background: 'rgba(255, 255, 255, 0.1)' }
                  }}
                >
                  {loadingTare ? 'Tariere...' : 'Tarieren'}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Collapse>
      </Paper>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
        <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.sev} sx={{ background: snackbar.sev === 'success' ? '#4CAF50' : '#F44336', color: 'white' }}>
          {snackbar.msg}
        </Alert>
      </Snackbar>

      {/* Hilfe-Dialog */}
      <Dialog 
        open={helpDialogOpen} 
        onClose={() => setHelpDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            backgroundImage: 'none',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: 1,
          }
        }}
      >
        <DialogTitle sx={{ 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          pb: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <HelpIcon sx={{ color: '#06b6d4', fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Kalibrierungs-Anleitung</Typography>
          </Box>
          <IconButton onClick={() => setHelpDialogOpen(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="h6" sx={{ color: '#06b6d4', mb: 2, fontWeight: 600 }}>
            So kalibrieren Sie die Waage richtig:
          </Typography>
          <List sx={{ color: '#cbd5e1' }}>
            <ListItem sx={{ py: 1, px: 0 }}>
              <ListItemText 
                primary="1. Vorbereitung"
                secondary="Stellen Sie sicher, dass die Waage auf einer stabilen, ebenen Fläche steht und nichts darauf liegt."
                primaryTypographyProps={{ color: 'white', fontWeight: 600, mb: 0.5 }}
                secondaryTypographyProps={{ color: '#cbd5e1' }}
              />
            </ListItem>
            <ListItem sx={{ py: 1, px: 0 }}>
              <ListItemText 
                primary="2. Tarieren"
                secondary="Klicken Sie auf 'Tarieren', um die Waage auf Null zu setzen. Die Waage sollte leer sein."
                primaryTypographyProps={{ color: 'white', fontWeight: 600, mb: 0.5 }}
                secondaryTypographyProps={{ color: '#cbd5e1' }}
              />
            </ListItem>
            <ListItem sx={{ py: 1, px: 0 }}>
              <ListItemText 
                primary="3. Gewicht auflegen"
                secondary="Legen Sie ein bekanntes Gewicht (z.B. 100g, 200g oder 500g) auf die Waage. Verwenden Sie ein präzises Gewicht für beste Ergebnisse."
                primaryTypographyProps={{ color: 'white', fontWeight: 600, mb: 0.5 }}
                secondaryTypographyProps={{ color: '#cbd5e1' }}
              />
            </ListItem>
            <ListItem sx={{ py: 1, px: 0 }}>
              <ListItemText 
                primary="4. Wert eingeben"
                secondary="Geben Sie das exakte Gewicht in Gramm in das Feld 'Bekanntes Gewicht' ein."
                primaryTypographyProps={{ color: 'white', fontWeight: 600, mb: 0.5 }}
                secondaryTypographyProps={{ color: '#cbd5e1' }}
              />
            </ListItem>
            <ListItem sx={{ py: 1, px: 0 }}>
              <ListItemText 
                primary="5. Kalibrieren"
                secondary="Klicken Sie auf 'Kalibrieren'. Die Waage wird nun anhand des bekannten Gewichts kalibriert."
                primaryTypographyProps={{ color: 'white', fontWeight: 600, mb: 0.5 }}
                secondaryTypographyProps={{ color: '#cbd5e1' }}
              />
            </ListItem>
          </List>
          <Box sx={{ 
            p: 2, 
            mt: 2, 
            borderRadius: 0.5, 
            backgroundColor: 'rgba(255, 152, 0, 0.1)', 
            border: '1px solid rgba(255, 152, 0, 0.3)' 
          }}>
            <Typography variant="body2" sx={{ color: '#FF9800', fontWeight: 600 }}>
              💡 Tipp: Führen Sie die Kalibrierung regelmäßig durch (z.B. monatlich) für beste Genauigkeit!
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button 
            onClick={() => setHelpDialogOpen(false)}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              fontWeight: 700,
              px: 4,
              '&:hover': {
                background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
              }
            }}
          >
            Verstanden
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WeightConfigComponent;
