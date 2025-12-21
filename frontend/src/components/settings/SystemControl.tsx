import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  IconButton,
  Chip,
  Stack,
  Collapse,
  Divider
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SettingsPowerIcon from '@mui/icons-material/SettingsPower';
import config from '../../config';

interface SystemControlProps {
  onAction?: (action: string) => void;
}

const SystemControl: React.FC<SystemControlProps> = ({ onAction }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean, action: string, title: string, description: string } | null>(null);

  const handleAction = async (action: string) => {
    setLoading(true);
    setMessage(null);

    try {
      let endpoint = '';
      let successMsg = '';

      switch (action) {
        case 'restart_backend':
          endpoint = `${config.apiBaseUrl}/system/restart_backend`;
          successMsg = 'Backend wird neu gestartet. Dies kann 10-30 Sekunden dauern...';
          break;
        case 'reboot':
          endpoint = `${config.apiBaseUrl}/system/reboot`;
          successMsg = 'System wird neu gestartet. Bitte warten Sie ca. 1-2 Minuten...';
          break;
        case 'shutdown':
          endpoint = `${config.apiBaseUrl}/system/shutdown`;
          successMsg = 'System wird heruntergefahren...';
          break;
        default:
          throw new Error('Unbekannte Aktion');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessage({ type: 'success', text: data.message || successMsg });
        
        if (onAction) {
          onAction(action);
        }

        if (action === 'restart_backend') {
          setTimeout(() => {
            window.location.reload();
          }, 15000);
        }
        
        if (action === 'reboot') {
          setTimeout(() => {
            setMessage({ 
              type: 'info', 
              text: 'System startet neu... Die Seite wird automatisch neu geladen.' 
            });
          }, 3000);
          
          setTimeout(() => {
            window.location.reload();
          }, 60000);
        }
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || 'Fehler beim Ausführen der Aktion' });
      }
    } catch (error) {
      console.error('System control error:', error);
      setMessage({ type: 'error', text: `Fehler: ${error}` });
    } finally {
      setLoading(false);
      setConfirmDialog(null);
    }
  };

  const openConfirmDialog = (action: string) => {
    let title = '';
    let description = '';

    switch (action) {
      case 'restart_backend':
        title = 'Backend neu starten?';
        description = 'Das Backend wird neu gestartet. Die Verbindung wird kurzzeitig unterbrochen (ca. 10-30 Sekunden). Sensoren und Motor werden neu initialisiert.';
        break;
      case 'reboot':
        title = 'System neu starten?';
        description = 'Der Raspberry Pi wird komplett neu gestartet. Dies dauert ca. 1-2 Minuten. Alle Verbindungen werden getrennt.';
        break;
      case 'shutdown':
        title = 'System herunterfahren?';
        description = 'Der Raspberry Pi wird heruntergefahren. Um ihn wieder zu starten, müssen Sie ihn physisch neu starten (Stromversorgung).';
        break;
    }

    setConfirmDialog({ open: true, action, title, description });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog(null);
  };

  const confirmAction = () => {
    if (confirmDialog) {
      handleAction(confirmDialog.action);
    }
  };

  return (
    <Paper sx={{ p: 4, borderRadius: 1, border: '1px solid rgba(255, 255, 255, 0.08)', background: '#1a1a1a' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: open ? 3 : 0, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 48,
            height: 48,
            borderRadius: 0.5,
            background: 'rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}>
            <SettingsPowerIcon sx={{ fontSize: 28, color: '#ef4444' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, fontSize: '1.1rem' }}>System-Kontrolle</Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.85rem' }}>Backend & System Neustarts</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={loading ? 'Läuft...' : 'Bereit'}
            size="small"
            sx={{
              backgroundColor: loading ? 'rgba(245, 158, 11, 0.2)' : 'rgba(76, 175, 80, 0.2)',
              color: loading ? '#f59e0b' : '#4CAF50',
              border: `1px solid ${loading ? 'rgba(245, 158, 11, 0.3)' : 'rgba(76, 175, 80, 0.3)'}`,
              fontWeight: 700,
              height: 24,
              fontSize: '0.7rem',
            }}
          />
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

          {/* Backend neu starten */}
          <Box sx={{ p: 3, borderRadius: 0.5, backgroundColor: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
              <Box sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                background: 'rgba(6, 182, 212, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(6, 182, 212, 0.3)',
              }}>
                <RefreshIcon sx={{ fontSize: 24, color: '#06b6d4' }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                  Backend neu starten
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                  Startet nur das Backend neu. Empfohlen bei Sensor-Problemen oder nach Konfigurationsänderungen.
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
              onClick={() => openConfirmDialog('restart_backend')}
              disabled={loading}
              fullWidth
              sx={{
                py: 1.5,
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' },
                '&:disabled': { background: 'rgba(255, 255, 255, 0.1)' }
              }}
            >
              Backend neu starten
            </Button>
          </Box>

          {/* System neu starten */}
          <Box sx={{ p: 3, borderRadius: 0.5, backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
              <Box sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                background: 'rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}>
                <RestartAltIcon sx={{ fontSize: 24, color: '#f59e0b' }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                  System neu starten
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                  Startet den gesamten Raspberry Pi neu. Empfohlen bei größeren Problemen oder nach System-Updates.
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <RestartAltIcon />}
              onClick={() => openConfirmDialog('reboot')}
              disabled={loading}
              fullWidth
              sx={{
                py: 1.5,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' },
                '&:disabled': { background: 'rgba(255, 255, 255, 0.1)' }
              }}
            >
              System neu starten
            </Button>
          </Box>

          {/* System herunterfahren */}
          <Box sx={{ p: 3, borderRadius: 0.5, backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
              <Box sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                background: 'rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}>
                <PowerSettingsNewIcon sx={{ fontSize: 24, color: '#ef4444' }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                  System herunterfahren
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                  Fährt den Raspberry Pi herunter. Kann nur durch physischen Neustart wieder gestartet werden.
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <PowerSettingsNewIcon />}
              onClick={() => openConfirmDialog('shutdown')}
              disabled={loading}
              fullWidth
              sx={{
                py: 1.5,
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' },
                '&:disabled': { background: 'rgba(255, 255, 255, 0.1)' }
              }}
            >
              System herunterfahren
            </Button>
          </Box>

          {/* Info Box */}
          <Box sx={{ p: 2.5, backgroundColor: 'rgba(6, 182, 212, 0.1)', borderRadius: 0.5, border: '1px solid rgba(6, 182, 212, 0.3)' }}>
            <Typography variant="body2" sx={{ color: '#06b6d4', fontSize: '0.85rem', lineHeight: 1.6 }}>
              ⚠️ <strong>Hinweis:</strong> Diese Aktionen erfordern sudo-Berechtigungen. Siehe SUDO_SETUP.md für die Konfiguration.
            </Typography>
          </Box>
        </Stack>
      </Collapse>

      {/* Bestätigungs-Dialog */}
      <Dialog
        open={confirmDialog?.open || false}
        onClose={closeConfirmDialog}
        PaperProps={{
          sx: {
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 1
          }
        }}
      >
        <DialogTitle sx={{ color: 'white', fontWeight: 700 }}>
          {confirmDialog?.title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#94a3b8' }}>
            {confirmDialog?.description}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={closeConfirmDialog}
            variant="outlined"
            sx={{ 
              color: '#cbd5e1',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              '&:hover': { borderColor: 'rgba(255, 255, 255, 0.4)', backgroundColor: 'rgba(255, 255, 255, 0.05)' }
            }}
          >
            Abbrechen
          </Button>
          <Button 
            onClick={confirmAction}
            variant="contained"
            sx={{
              background: confirmDialog?.action === 'shutdown' 
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : confirmDialog?.action === 'reboot'
                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              '&:hover': {
                background: confirmDialog?.action === 'shutdown'
                  ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                  : confirmDialog?.action === 'reboot'
                  ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                  : 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)'
              }
            }}
          >
            Bestätigen
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default SystemControl;
