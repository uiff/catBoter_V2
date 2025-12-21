import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import SpeedIcon from '@mui/icons-material/Speed';
import { styled } from '@mui/material/styles';

interface DistanceSensorComponentProps {
  value: number;
  title: string;
}

// Styled Linear Progress mit Glassmorphism
const StyledLinearProgress = styled(LinearProgress)(({ theme }) => ({
  height: 24,
  borderRadius: 12,
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  overflow: 'hidden',
  '& .MuiLinearProgress-bar': {
    borderRadius: 12,
    background: 'linear-gradient(90deg, var(--bar-color-start) 0%, var(--bar-color-end) 100%)',
    boxShadow: '0 0 20px var(--bar-glow)',
    transition: 'all 0.4s ease-in-out',
  }
}));

const DistanceSensorComponent: React.FC<DistanceSensorComponentProps> = ({ value, title }) => {
  // Invertiere den Wert: Der Sensor misst Abstand, wir wollen Füllstand anzeigen
  // Füllstand = 100 - Abstand
  const fillLevel = 100 - value;
  
  // Bestimme Farben basierend auf dem Füllstand
  const getProgressStyle = (val: number) => {
    if (val >= 80) {
      return {
        '--bar-color-start': '#4CAF50',
        '--bar-color-end': '#8BC34A',
        '--bar-glow': 'rgba(76, 175, 80, 0.6)',
        status: 'Optimal',
        statusColor: '#4CAF50'
      };
    }
    if (val >= 50) {
      return {
        '--bar-color-start': '#FF9800',
        '--bar-color-end': '#FFC107',
        '--bar-glow': 'rgba(255, 152, 0, 0.6)',
        status: 'Mittel',
        statusColor: '#FF9800'
      };
    }
    if (val >= 20) {
      return {
        '--bar-color-start': '#F44336',
        '--bar-color-end': '#E91E63',
        '--bar-glow': 'rgba(244, 67, 54, 0.6)',
        status: 'Niedrig',
        statusColor: '#F44336'
      };
    }
    return {
      '--bar-color-start': '#D32F2F',
      '--bar-color-end': '#F44336',
      '--bar-glow': 'rgba(211, 47, 47, 0.6)',
      status: 'Kritisch',
      statusColor: '#D32F2F'
    };
  };

  const progressStyle = getProgressStyle(fillLevel);

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 3
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SpeedIcon sx={{ 
            fontSize: 28, 
            color: 'white', 
            opacity: 0.9,
            filter: `drop-shadow(0 0 10px ${progressStyle.statusColor}40)`
          }} />
          <Typography variant="h6" sx={{ 
            color: 'white', 
            fontWeight: 600,
            opacity: 0.9
          }}>
            {title}
          </Typography>
        </Box>

        {/* Status Badge */}
        <Box sx={{
          px: 2,
          py: 0.5,
          borderRadius: 0.5,
          backgroundColor: `${progressStyle.statusColor}20`,
          border: `1px solid ${progressStyle.statusColor}40`,
        }}>
          <Typography variant="caption" sx={{ 
            color: progressStyle.statusColor,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 1
          }}>
            {progressStyle.status}
          </Typography>
        </Box>
      </Box>

      {/* Progress Bar Container */}
      <Box sx={{ position: 'relative', mb: 2 }}>
        <StyledLinearProgress 
          variant="determinate" 
          value={fillLevel}
          sx={progressStyle as any}
        />
        
        {/* Percentage Overlay */}
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5
        }}>
          <Typography variant="body1" sx={{ 
            color: 'white',
            fontWeight: 700,
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            fontSize: '0.9rem'
          }}>
            {fillLevel}%
          </Typography>
        </Box>
      </Box>

      {/* Additional Info */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 2,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 0.5,
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <Box>
          <Typography variant="caption" sx={{ 
            color: 'white', 
            opacity: 0.6,
            display: 'block'
          }}>
            Aktueller Füllstand
          </Typography>
          <Typography variant="h4" sx={{ 
            color: progressStyle.statusColor,
            fontWeight: 700,
            textShadow: `0 0 20px ${progressStyle.statusColor}60`,
            lineHeight: 1,
            mt: 0.5
          }}>
            {fillLevel}%
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" sx={{ 
            color: 'white', 
            opacity: 0.6,
            display: 'block'
          }}>
            Kapazität
          </Typography>
          <Typography variant="body1" sx={{ 
            color: 'white',
            opacity: 0.9,
            fontWeight: 500,
            mt: 0.5
          }}>
            {value.toFixed(0)}% leer
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default DistanceSensorComponent;
