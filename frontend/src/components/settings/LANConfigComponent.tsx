// src/components/settings/LANConfigComponent.tsx - Modern Dashboard Style
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Box,
  TextField,
  Button,
  FormGroup,
  FormControlLabel,
  Switch,
  Snackbar,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  IconButton,
  Chip,
  Stack,
  Divider,
  Collapse,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Router as RouterIcon,
  CheckCircle as CheckCircleIcon,
  SettingsEthernet as SettingsEthernetIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import axios from 'axios';
import config from '../../config';

const LANConfigComponent: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [useDHCP, setUseDHCP] = useState(true);
  const [ip, setIp] = useState('');
  const [netmask, setNetmask] = useState('');
  const [gateway, setGateway] = useState('');
  const [dns, setDns] = useState('');
  const [interfaces, setInterfaces] = useState<any>({});
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(false);

  const fetchNetworkInfo = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${config.apiBaseUrl}/system/network`);
      const data = response.data;
      setInterfaces(data || {});
      setUseDHCP(data.eth0?.use_dhcp !== false);
      if (!data.eth0?.use_dhcp) {
        setIp(data.eth0?.ip_address || '');
        setNetmask(data.eth0?.netmask || '');
        setGateway(data.eth0?.gateway || '');
        setDns(data.eth0?.dns || '');
      }
    } catch (error) {
      setSnackbarMessage('Fehler beim Abrufen der Netzwerkinformationen.');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNetworkInfo();
  }, [fetchNetworkInfo]);

  const handleSaveLANConfig = async () => {
    try {
      setLoading(true);
      await axios.post(`${config.apiBaseUrl}/system/configure_lan`, {
        use_dhcp: useDHCP,
        ip: useDHCP ? '' : ip,
        netmask: useDHCP ? '' : netmask,
        gateway: useDHCP ? '' : gateway,
        dns: useDHCP ? '' : dns,
      });
      setSnackbarMessage('LAN-Konfiguration erfolgreich gespeichert.');
      setSnackbarSeverity('success');
      setOpenSnackbar(true);
      setTimeout(() => fetchNetworkInfo(), 2000);
    } catch (error) {
      setSnackbarMessage('Fehler beim Speichern der LAN-Konfiguration.');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
    } finally {
      setLoading(false);
    }
  };

  const isConnected = interfaces.eth0 && interfaces.eth0.ip_address;
  const connectionType = useDHCP ? 'DHCP' : 'Statisch';

  return (
    <Paper sx={{ p: 4, borderRadius: 1, border: '1px solid rgba(255, 255, 255, 0.08)', background: '#1a1a1a' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: open ? 3 : 0, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 48,
            height: 48,
            borderRadius: 0.5,
            background: 'rgba(6, 182, 212, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(6, 182, 212, 0.3)',
          }}>
            <SettingsEthernetIcon sx={{ fontSize: 28, color: '#06b6d4' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, fontSize: '1.1rem' }}>Ethernet-Verbindung</Typography>
            {isConnected && (
              <Typography variant="body2" sx={{ color: '#06b6d4', fontSize: '0.85rem' }}>{interfaces.eth0?.ip_address}</Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={isConnected ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : undefined}
            label={isConnected ? 'Verbunden' : 'Getrennt'}
            size="small"
            sx={{
              backgroundColor: isConnected ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
              color: isConnected ? '#4CAF50' : '#F44336',
              border: `1px solid ${isConnected ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'}`,
              fontWeight: 700,
              height: 24,
              fontSize: '0.7rem',
              '& .MuiChip-icon': { color: isConnected ? '#4CAF50' : '#F44336' }
            }}
          />
          <IconButton onClick={fetchNetworkInfo} disabled={loading} sx={{ color: '#cbd5e1' }} size="small">
            {loading ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
          <IconButton sx={{ color: 'white' }}>
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={open}>
        <Stack spacing={3}>
          {isConnected && (
        <Box sx={{ mb: 3, p: 3, borderRadius: 0.5, backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
          <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1 }}>IP-Adresse</Typography>
          <Typography variant="h6" sx={{ color: '#06b6d4', fontWeight: 700, mb: 2 }}>{interfaces.eth0.ip_address}</Typography>
          <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 0.5 }}>Verbindungstyp</Typography>
          <Typography variant="h6" sx={{ color: '#06b6d4', fontWeight: 700 }}>{connectionType}</Typography>
        </Box>
          )}

          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

          <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={useDHCP}
                onChange={(e) => {
                  setUseDHCP(e.target.checked);
                  if (e.target.checked) {
                    setIp('');
                    setNetmask('');
                    setGateway('');
                    setDns('');
                  }
                }}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#06b6d4' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#06b6d4' }
                }}
              />
            }
            label={
              <Box>
                <Typography sx={{ color: 'white', fontWeight: 600, mb: 0.5 }}>DHCP verwenden</Typography>
                <Typography variant="body2" sx={{ color: '#cbd5e1' }}>IP-Adresse wird automatisch zugewiesen</Typography>
              </Box>
            }
          />
          </FormGroup>

          {!useDHCP && (
          <Box sx={{ p: 3, borderRadius: 0.5, backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <RouterIcon sx={{ fontSize: 24 }} />
              Manuelle Konfiguration
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="IP-Adresse"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="192.168.1.100"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: '#06b6d4' },
                      '&.Mui-focused fieldset': { borderColor: '#06b6d4' }
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-focused': { color: '#06b6d4' }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Netzmaske"
                  value={netmask}
                  onChange={(e) => setNetmask(e.target.value)}
                  placeholder="255.255.255.0"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: '#06b6d4' },
                      '&.Mui-focused fieldset': { borderColor: '#06b6d4' }
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-focused': { color: '#06b6d4' }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Gateway"
                  value={gateway}
                  onChange={(e) => setGateway(e.target.value)}
                  placeholder="192.168.1.1"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: '#06b6d4' },
                      '&.Mui-focused fieldset': { borderColor: '#06b6d4' }
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-focused': { color: '#06b6d4' }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="DNS-Server"
                  value={dns}
                  onChange={(e) => setDns(e.target.value)}
                  placeholder="8.8.8.8"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: '#06b6d4' },
                      '&.Mui-focused fieldset': { borderColor: '#06b6d4' }
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-focused': { color: '#06b6d4' }
                    }
                  }}
                />
              </Grid>
            </Grid>
          </Box>
          )}

          <Button
          variant="contained"
          onClick={handleSaveLANConfig}
          fullWidth
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <SettingsIcon />}
          sx={{ 
            py: 1.5,
            background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' },
            '&:disabled': { background: 'rgba(255, 255, 255, 0.1)' }
          }}
        >
          {loading ? 'Wird gespeichert...' : 'Einstellungen speichern'}
          </Button>
        </Stack>
      </Collapse>

      <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={() => setOpenSnackbar(false)}>
        <Alert onClose={() => setOpenSnackbar(false)} severity={snackbarSeverity} sx={{ background: snackbarSeverity === 'success' ? '#4CAF50' : '#F44336', color: 'white' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default LANConfigComponent;
