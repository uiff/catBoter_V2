// WLANConfigComponent.tsx - Modern Dashboard Style mit korrekter Signalstärke
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
  Chip,
  IconButton,
  Stack,
  Divider,
  Collapse,
} from '@mui/material';
import {
  Wifi as WifiIcon,
  Refresh as RefreshIcon,
  SignalWifi4Bar as SignalWifi4BarIcon,
  SignalWifi3Bar as SignalWifi3BarIcon,
  SignalWifi2Bar as SignalWifi2BarIcon,
  SignalWifi1Bar as SignalWifi1BarIcon,
  SignalWifi0Bar as SignalWifi0BarIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import axios from 'axios';
import config from '../../config';

interface NetworkInfo {
  current_ip: string;
  wifi_ssid?: string;
  wlan0?: { ip_address: string };
}

interface WifiNetwork {
  ssid: string;
  signal_strength: number;
  encrypted: boolean;
  bssid?: string;
}

const WLANConfigComponent: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);

  const fetchNetworkInfo = useCallback(async () => {
    try {
      const response = await axios.get(`${config.apiBaseUrl}/system/network`);
      setNetworkInfo(response.data);
    } catch (error) {
      console.error('Error fetching network info:', error);
    }
  }, []);

  const scanWifiNetworks = useCallback(async () => {
    try {
      setScanLoading(true);
      const response = await axios.get(`${config.apiBaseUrl}/system/scan_wifi`, { timeout: 30000 });
      
      console.log('WiFi Scan Response:', response.data);
      
      const networks = response.data.networks || [];
      
      // Dedupliziere Netzwerke (nehme stärkstes Signal)
      const uniqueNetworks = networks.reduce((acc: WifiNetwork[], current: WifiNetwork) => {
        const existing = acc.find(item => item.ssid === current.ssid);
        if (!existing) {
          acc.push(current);
        } else if (current.signal_strength > existing.signal_strength) {
          const index = acc.indexOf(existing);
          acc[index] = current;
        }
        return acc;
      }, []);
      
      // Sortiere nach Signalstärke (stärkste zuerst)
      uniqueNetworks.sort((a: WifiNetwork, b: WifiNetwork) => b.signal_strength - a.signal_strength);
      
      console.log('Unique WiFi Networks:', uniqueNetworks);
      setWifiNetworks(uniqueNetworks);
      
      setSnackbarMessage(`${uniqueNetworks.length} WLAN-Netzwerke gefunden`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('WiFi Scan Error:', error);
      setSnackbarMessage('Fehler beim Scannen nach WLAN-Netzwerken');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setScanLoading(false);
    }
  }, []);

  const connectToWifi = useCallback(async () => {
    if (!selectedNetwork) {
      setSnackbarMessage('Bitte wählen Sie ein WLAN-Netzwerk aus');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    try {
      setConnecting(true);
      const response = await axios.post(`${config.apiBaseUrl}/system/connect_wifi`, {
        ssid: selectedNetwork,
        password: password
      }, { timeout: 60000 });
      
      if (response.data.success !== false) {
        setSnackbarMessage(`Erfolgreich mit ${selectedNetwork} verbunden`);
        setSnackbarSeverity('success');
        setSelectedNetwork('');
        setPassword('');
        setTimeout(() => fetchNetworkInfo(), 3000);
      } else {
        setSnackbarMessage(response.data.message || 'Verbindung fehlgeschlagen');
        setSnackbarSeverity('error');
      }
    } catch (error) {
      setSnackbarMessage('Fehler beim Verbinden mit dem WLAN');
      setSnackbarSeverity('error');
    } finally {
      setConnecting(false);
      setSnackbarOpen(true);
    }
  }, [selectedNetwork, password, fetchNetworkInfo]);

  // Verbesserte Signalstärke-Berechnung
  const getSignalIcon = (strength: number) => {
    console.log(`Signal Strength for Icon: ${strength}`);
    if (strength >= 80) return <SignalWifi4BarIcon />;
    if (strength >= 60) return <SignalWifi3BarIcon />;
    if (strength >= 40) return <SignalWifi2BarIcon />;
    if (strength >= 20) return <SignalWifi1BarIcon />;
    return <SignalWifi0BarIcon />;
  };

  const getSignalInfo = (strength: number) => {
    // Vereinfachte Signalstärke mit Standard-Farbe
    const normalizedStrength = Math.max(0, Math.min(100, strength || 0));
    return { 
      color: '#06b6d4', 
      text: `${normalizedStrength}`, 
      bgColor: 'rgba(6, 182, 212, 0.15)' 
    };
  };

  useEffect(() => {
    fetchNetworkInfo();
    scanWifiNetworks();
  }, [fetchNetworkInfo, scanWifiNetworks]);

  const isConnected = networkInfo?.wifi_ssid && networkInfo?.wlan0?.ip_address;

  return (
    <Paper sx={{ p: 4, borderRadius: 1, border: '1px solid rgba(255, 255, 255, 0.08)', background: '#1a1a1a' }}>
      {/* Header */}
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
            <WifiIcon sx={{ fontSize: 28, color: '#06b6d4' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, fontSize: '1.1rem' }}>WiFi-Verbindung</Typography>
            {isConnected && (
              <Typography variant="body2" sx={{ color: '#06b6d4', fontSize: '0.85rem' }}>{networkInfo?.wifi_ssid}</Typography>
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
          <IconButton onClick={fetchNetworkInfo} sx={{ color: '#cbd5e1' }} size="small">
            <RefreshIcon fontSize="small" />
          </IconButton>
          <IconButton sx={{ color: 'white' }}>
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={open}>
        <Stack spacing={3}>
          {/* Verbindungsinfo */}
          {isConnected && (
            <Box sx={{ p: 3, borderRadius: 0.5, backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
              <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1, fontWeight: 600 }}>Verbunden mit</Typography>
              <Typography variant="h6" sx={{ color: '#06b6d4', fontWeight: 700, mb: 2, fontSize: '1.2rem' }}>{networkInfo?.wifi_ssid}</Typography>
              <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 0.5, fontWeight: 600 }}>IP-Adresse</Typography>
              <Typography variant="body1" sx={{ color: 'white', fontWeight: 600 }}>{networkInfo?.wlan0?.ip_address}</Typography>
            </Box>
          )}

          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

          {/* Scan Button */}
          <Box sx={{ textAlign: 'center' }}>
            <Button
              variant="contained"
              onClick={scanWifiNetworks}
              disabled={scanLoading}
              startIcon={scanLoading ? <CircularProgress size={20} /> : <SearchIcon />}
              sx={{
                px: 4,
                py: 1.5,
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' },
                '&:disabled': { background: 'rgba(255, 255, 255, 0.1)' }
              }}
            >
              {scanLoading ? 'Scanne...' : 'Nach WLAN-Netzwerken scannen'}
            </Button>
          </Box>

          {/* Netzwerkliste */}
          {wifiNetworks.length > 0 && (
            <Stack spacing={2}>
              {wifiNetworks.slice(0, 10).map((network, index) => {
                const signalInfo = getSignalInfo(network.signal_strength);
                const isSelected = selectedNetwork === network.ssid;
                const isCurrentNetwork = networkInfo?.wifi_ssid === network.ssid;
                
                return (
                  <Box
                    key={`${network.ssid}-${index}`}
                    onClick={() => setSelectedNetwork(network.ssid)}
                    sx={{
                      p: 2.5,
                      borderRadius: 0.5,
                      border: isSelected ? `2px solid ${signalInfo.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: isSelected ? signalInfo.bgColor : 'rgba(255, 255, 255, 0.03)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': { 
                        borderColor: signalInfo.color,
                        backgroundColor: signalInfo.bgColor,
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ color: '#06b6d4', display: 'flex', alignItems: 'center' }}>
                          {getSignalIcon(network.signal_strength)}
                        </Box>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="body1" sx={{ fontWeight: 700, color: 'white' }}>{network.ssid}</Typography>
                            {network.encrypted ? 
                              <LockIcon sx={{ fontSize: 16, color: '#94a3b8' }} /> : 
                              <LockOpenIcon sx={{ fontSize: 16, color: '#4CAF50' }} />
                            }
                            {isCurrentNetwork && (
                              <Chip 
                                label="Aktiv" 
                                size="small" 
                                icon={<CheckCircleIcon />}
                                sx={{
                                  height: 20,
                                  fontSize: '0.65rem',
                                  backgroundColor: 'rgba(76, 175, 80, 0.2)',
                                  color: '#4CAF50',
                                  '& .MuiChip-icon': { fontSize: 12, color: '#4CAF50' }
                                }}
                              />
                            )}
                          </Box>
                          <Chip 
                            label={signalInfo.text}
                            size="small" 
                            sx={{
                              backgroundColor: 'rgba(6, 182, 212, 0.2)',
                              color: '#06b6d4',
                              height: 22,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              border: '1px solid rgba(6, 182, 212, 0.3)'
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}

          {/* Verbindungsformular */}
          {selectedNetwork && (
            <Box sx={{ p: 3, borderRadius: 0.5, backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'white' }}>
                Verbinden mit: <span style={{ color: '#06b6d4' }}>{selectedNetwork}</span>
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  type="password"
                  label="WLAN-Passwort"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={connecting}
                  onKeyPress={(e) => { if (e.key === 'Enter' && !connecting) connectToWifi(); }}
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
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => { setSelectedNetwork(''); setPassword(''); }}
                    fullWidth
                    sx={{ 
                      color: '#cbd5e1',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      '&:hover': { borderColor: 'rgba(255, 255, 255, 0.4)', backgroundColor: 'rgba(255, 255, 255, 0.05)' }
                    }}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    variant="contained"
                    onClick={connectToWifi}
                    disabled={connecting}
                    fullWidth
                    startIcon={connecting ? <CircularProgress size={20} /> : <WifiIcon />}
                    sx={{ 
                      py: 1.5,
                      background: 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)',
                      '&:hover': { background: 'linear-gradient(135deg, #388E3C 0%, #689F38 100%)' },
                      '&:disabled': { background: 'rgba(255, 255, 255, 0.1)' }
                    }}
                  >
                    {connecting ? 'Verbinde...' : 'Verbinden'}
                  </Button>
                </Box>
              </Stack>
            </Box>
          )}
        </Stack>
      </Collapse>

      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ background: snackbarSeverity === 'success' ? '#4CAF50' : '#F44336', color: 'white' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default WLANConfigComponent;
