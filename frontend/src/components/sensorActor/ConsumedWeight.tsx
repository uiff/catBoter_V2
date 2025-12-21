// src/components/sensorActor/ConsumedWeight.tsx

import React, { useEffect, useState } from 'react';
import { Typography, CircularProgress, Box, Alert } from '@mui/material';
import axios from 'axios';
import config from '../../config';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

interface ConsumedWeightProps {
  endpoint: string; // API-Endpunkt zur Abruf der konsumierten Gramm
}

const ConsumedWeight: React.FC<ConsumedWeightProps> = ({ endpoint }) => {
  const [consumedWeight, setConsumedWeight] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchConsumedWeight = async () => {
      try {
        setLoading(true);
        const response = await axios.get<{ consumed: number }>(`${config.apiBaseUrl}${endpoint}`);
        setConsumedWeight(response.data.consumed);
        setError('');
      } catch (err) {
        console.error(`Fehler beim Abrufen des konsumierten Gewichts von ${endpoint}:`, err);
        setError(`Fehler beim Abrufen des konsumierten Gewichts.`);
      } finally {
        setLoading(false);
      }
    };

    fetchConsumedWeight();
    const interval = setInterval(fetchConsumedWeight, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [endpoint]);

  if (loading && consumedWeight === null) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: 160,
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress 
          size={40} 
          sx={{ 
            color: 'white',
            filter: 'drop-shadow(0 4px 8px rgba(255,255,255,0.3))'
          }} 
        />
        <Typography variant="body2" sx={{ color: 'white', opacity: 0.7 }}>
          Lade Daten...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        sx={{ 
          backgroundColor: 'rgba(244, 67, 54, 0.2)',
          color: 'white',
          border: '1px solid rgba(244, 67, 54, 0.3)',
          '& .MuiAlert-icon': { color: 'white' }
        }}
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      gap: 2,
      p: 2,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: 0.5,
      border: '1px solid rgba(255,255,255,0.2)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Icon */}
      <TrendingDownIcon sx={{ 
        position: 'absolute',
        right: -20,
        bottom: -20,
        fontSize: 120,
        color: 'white',
        opacity: 0.05,
        transform: 'rotate(-15deg)'
      }} />

      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        mb: 1
      }}>
        <TrendingDownIcon sx={{ 
          fontSize: 24, 
          color: '#21CBF3',
          filter: 'drop-shadow(0 0 10px rgba(33, 203, 243, 0.5))'
        }} />
        <Typography variant="subtitle2" sx={{ 
          color: 'white', 
          opacity: 0.8,
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontSize: '0.75rem'
        }}>
          Heute konsumiert
        </Typography>
      </Box>

      <Typography variant="h2" sx={{ 
        color: '#21CBF3', 
        fontWeight: 700,
        textShadow: '0 0 25px rgba(33, 203, 243, 0.6)',
        lineHeight: 1,
        position: 'relative',
        zIndex: 1
      }}>
        {consumedWeight !== null ? consumedWeight.toFixed(1) : '0.0'}
      </Typography>
      
      <Typography variant="h6" sx={{ 
        color: 'white', 
        opacity: 0.9,
        fontWeight: 500
      }}>
        Gramm
      </Typography>

      <Box sx={{ 
        mt: 2,
        pt: 2,
        borderTop: '1px solid rgba(255,255,255,0.1)',
        width: '100%',
        textAlign: 'center'
      }}>
        <Typography variant="caption" sx={{ 
          color: 'white', 
          opacity: 0.6,
          fontSize: '0.7rem'
        }}>
          Letzte Aktualisierung: {new Date().toLocaleTimeString()}
        </Typography>
      </Box>
    </Box>
  );
};

export default ConsumedWeight;