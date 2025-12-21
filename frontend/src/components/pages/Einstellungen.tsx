// src/components/pages/Einstellungen.tsx - Modern & Clean
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Alert, Container, Stack } from '@mui/material';
import axios from 'axios';
import config from '../../config';
import WLANConfigComponent from '../settings/WLANConfigComponent';
import LANConfigComponent from '../settings/LANConfigComponent';
import Notifications from '../settings/Notifications';
import SwaggerAPIDocumentation from '../settings/SwaggerAPIDocumentation';
import SystemControl from '../settings/SystemControl';
import TimeConfiguration from '../settings/TimeConfiguration';
import '../../styles.css';

interface SensorData {
  distance: number;
}

const Einstellungen: React.FC = () => {
  const [error, setError] = useState('');
  const [alerts, setAlerts] = useState<string[]>([]);
  
  const fetchNetworkInfo = useCallback(async () => {
    try {
      await axios.get(`${config.apiBaseUrl}/system/network`, { timeout: 10000 });
    } catch {
      setError('Netzwerkinformationen konnten nicht geladen werden');
    }
  }, []);

  const fetchSensorData = useCallback(async () => {
    try {
      const res = await axios.get<SensorData>(`${config.apiBaseUrl}/sensors`, { timeout: 10000 });
      const fillLevel = res.data.distance;
      
      // Prüfe Warnungen
      const newAlerts: string[] = [];
      if (fillLevel < 10) {
        newAlerts.push('⚠️ Futtertank-Füllstand kritisch niedrig (unter 10%)');
      } else if (fillLevel < 20) {
        newAlerts.push('⚠️ Futtertank-Füllstand niedrig (unter 20%)');
      }
      
      setAlerts(newAlerts);
    } catch {
      // Fehler ignorieren, Benachrichtigungen sind optional
    }
  }, []);

  useEffect(() => {
    fetchNetworkInfo();
    fetchSensorData();
    
    // Aktualisiere Sensor-Daten alle 30 Sekunden
    const interval = setInterval(fetchSensorData, 30000);
    return () => clearInterval(interval);
  }, [fetchNetworkInfo, fetchSensorData]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', px: 0, py: { xs: 0, sm: 5 } }}>
      <Container maxWidth="md" disableGutters sx={{ px: { xs: 0, sm: 3 } }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mx: { xs: 2, sm: 0 },
              mb: { xs: 0, sm: 4 },
              background: '#1a1a1a',
              border: '1px solid rgba(244, 67, 54, 0.3)',
              color: 'white',
              borderRadius: { xs: 0, sm: 1 },
              '& .MuiAlert-icon': { color: '#F44336' }
            }}
          >
            {error}
          </Alert>
        )}

        <Stack spacing={{ xs: 3, sm: 4 }} sx={{ width: '100%' }}>
          <WLANConfigComponent />
          <LANConfigComponent />
          <TimeConfiguration />
          <Notifications alerts={alerts} />
          <SystemControl />
          <SwaggerAPIDocumentation />
        </Stack>
      </Container>
    </Box>
  );
};

export default Einstellungen;
