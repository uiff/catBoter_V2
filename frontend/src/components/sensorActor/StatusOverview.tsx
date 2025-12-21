import React from 'react';
import { Typography, Grid, Tooltip, Box, Chip } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import Battery50Icon from '@mui/icons-material/Battery50';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import ScaleIcon from '@mui/icons-material/Scale';
import ScheduleIcon from '@mui/icons-material/Schedule';
import '../../styles.css';

interface StatusOverviewProps {
  distance: number; // Abstand in % (vom Sensor gemessen)
  weight: number; // in g, bereits auf 0.5 gerundet
  nextFeedingTime: string; // nächste Fütterungszeit als Uhrzeit
}

const StatusOverview: React.FC<StatusOverviewProps> = ({ distance, weight, nextFeedingTime }) => {
  // Der Sensor gibt bereits den Füllstand zurück
  const fillLevel = distance;
  
  const getFillLevelInfo = (fillLevel: number) => {
    if (fillLevel >= 80) {
      return { 
        color: '#4CAF50', 
        bgColor: 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)',
        icon: <BatteryFullIcon sx={{ fontSize: 36 }} />,
        status: 'Optimal',
        textColor: 'white'
      };
    }
    if (fillLevel >= 50) {
      return { 
        color: '#FF9800', 
        bgColor: 'linear-gradient(135deg, #FF9800 0%, #FFC107 100%)',
        icon: <Battery50Icon sx={{ fontSize: 36 }} />,
        status: 'Gut',
        textColor: 'white'
      };
    }
    if (fillLevel >= 20) {
      return { 
        color: '#F44336', 
        bgColor: 'linear-gradient(135deg, #F44336 0%, #E91E63 100%)',
        icon: <BatteryAlertIcon sx={{ fontSize: 36 }} />,
        status: 'Niedrig',
        textColor: 'white'
      };
    }
    return { 
      color: '#D32F2F', 
      bgColor: 'linear-gradient(135deg, #D32F2F 0%, #F44336 100%)',
      icon: <BatteryAlertIcon sx={{ fontSize: 36 }} />,
      status: 'Kritisch',
      textColor: 'white'
    };
  };

  const getWeightStatus = (weight: number) => {
    if (weight >= 200) return { status: 'Voll', color: '#4CAF50' };
    if (weight >= 100) return { status: 'Mittel', color: '#FF9800' };
    if (weight >= 50) return { status: 'Wenig', color: '#F44336' };
    return { status: 'Leer', color: '#D32F2F' };
  };

  const getTimeStatus = (timeString: string) => {
    if (!timeString || timeString === 'Keine geplant') {
      return { status: 'Keine Fütterung', color: '#9E9E9E' };
    }
    
    const now = new Date();
    const [hours, minutes] = timeString.split(':').map(Number);
    const feedingTime = new Date();
    feedingTime.setHours(hours, minutes, 0, 0);
    
    const diffMs = feedingTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 0) {
      return { status: 'Verpasst', color: '#F44336' };
    } else if (diffHours < 1) {
      return { status: 'Bald', color: '#FF9800' };
    } else {
      return { status: 'Geplant', color: '#4CAF50' };
    }
  };

  const fillLevelInfo = getFillLevelInfo(fillLevel);
  const weightStatus = getWeightStatus(weight);
  const timeStatus = getTimeStatus(nextFeedingTime);

  return (
    <Grid container spacing={3}>
      {/* Füllstand Card */}
      <Grid item xs={12} sm={6} md={4}>
        <Box
          className="animate-slide-in"
          sx={{
            background: fillLevelInfo.bgColor,
            color: fillLevelInfo.textColor,
            p: 3,
            borderRadius: 1,
            boxShadow: `0 8px 32px ${fillLevelInfo.color}40`,
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: `0 12px 48px ${fillLevelInfo.color}60`,
            }
          }}
        >
          <Tooltip title="Aktueller Füllstand des Futternapfs" arrow>
            <HelpOutlineIcon
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                cursor: 'pointer',
                opacity: 0.8,
                fontSize: 20
              }}
            />
          </Tooltip>
          
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ mb: 2 }}>
              {fillLevelInfo.icon}
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, opacity: 0.9 }}>
              Füllstand
            </Typography>
            <Typography variant="h2" sx={{ 
              fontWeight: 700, 
              mb: 2,
              textShadow: '0 0 30px rgba(255,255,255,0.5)'
            }}>
              {fillLevel}%
            </Typography>
            <Chip 
              label={fillLevelInfo.status}
              sx={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.3)',
                backdropFilter: 'blur(10px)'
              }}
            />
          </Box>
        </Box>
      </Grid>

      {/* Gewicht Futternapf Card */}
      <Grid item xs={12} sm={6} md={4}>
        <Box
          className="glassmorphism-paper animate-slide-in"
          sx={{
            p: 3,
            borderRadius: 1,
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 12px 48px rgba(33, 203, 243, 0.3)',
            }
          }}
        >
          <Tooltip title="Aktuelles Gewicht des Futternapfs" arrow>
            <HelpOutlineIcon
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                cursor: 'pointer',
                color: 'white',
                opacity: 0.6,
                fontSize: 20
              }}
            />
          </Tooltip>
          
          <Box sx={{ textAlign: 'center' }}>
            <ScaleIcon sx={{ 
              color: '#21CBF3', 
              fontSize: 40,
              mb: 2,
              filter: 'drop-shadow(0 0 15px rgba(33, 203, 243, 0.5))'
            }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'white', mb: 1, opacity: 0.9 }}>
              Gewicht Futternapf
            </Typography>
            <Typography variant="h2" sx={{ 
              color: '#21CBF3', 
              fontWeight: 700, 
              mb: 1,
              textShadow: '0 0 25px rgba(33, 203, 243, 0.6)'
            }}>
              {weight.toFixed(1)}
            </Typography>
            <Typography variant="h6" sx={{ color: 'white', opacity: 0.8, mb: 2 }}>
              Gramm
            </Typography>
            <Chip 
              label={weightStatus.status}
              sx={{
                backgroundColor: `${weightStatus.color}20`,
                color: weightStatus.color,
                fontWeight: 600,
                border: `1px solid ${weightStatus.color}40`,
                backdropFilter: 'blur(10px)'
              }}
            />
          </Box>
        </Box>
      </Grid>

      {/* Nächste Fütterungszeit Card */}
      <Grid item xs={12} sm={12} md={4}>
        <Box
          className="glassmorphism-paper animate-slide-in"
          sx={{
            p: 3,
            borderRadius: 1,
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 12px 48px rgba(139, 195, 74, 0.3)',
            }
          }}
        >
          <Tooltip title="Zeitpunkt der nächsten geplanten Fütterung" arrow>
            <HelpOutlineIcon
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                cursor: 'pointer',
                color: 'white',
                opacity: 0.6,
                fontSize: 20
              }}
            />
          </Tooltip>
          
          <Box sx={{ textAlign: 'center' }}>
            <ScheduleIcon sx={{ 
              color: '#8BC34A', 
              fontSize: 40,
              mb: 2,
              filter: 'drop-shadow(0 0 15px rgba(139, 195, 74, 0.5))'
            }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'white', mb: 1, opacity: 0.9 }}>
              Nächste Fütterung
            </Typography>
            <Typography variant="h2" sx={{ 
              color: '#8BC34A', 
              fontWeight: 700, 
              mb: 1,
              textShadow: '0 0 25px rgba(139, 195, 74, 0.6)'
            }}>
              {nextFeedingTime || '--:--'}
            </Typography>
            <Typography variant="body1" sx={{ color: 'white', opacity: 0.8, mb: 2 }}>
              {nextFeedingTime ? 'Heute' : 'Keine Fütterung'}
            </Typography>
            <Chip 
              label={timeStatus.status}
              sx={{
                backgroundColor: `${timeStatus.color}20`,
                color: timeStatus.color === '#9E9E9E' ? 'white' : timeStatus.color,
                fontWeight: 600,
                border: `1px solid ${timeStatus.color}40`,
                backdropFilter: 'blur(10px)',
                opacity: timeStatus.color === '#9E9E9E' ? 0.7 : 1
              }}
            />
          </Box>
        </Box>
      </Grid>
    </Grid>
  );
};

export default StatusOverview;
