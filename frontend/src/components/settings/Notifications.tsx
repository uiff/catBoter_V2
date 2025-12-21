// Notifications.tsx - Modern Dashboard Style mit Collapse
import React, { useState } from 'react';
import { 
  Paper, 
  Typography, 
  Alert, 
  Stack, 
  Box, 
  IconButton, 
  Chip, 
  Collapse 
} from '@mui/material';
import { 
  Notifications as NotificationsIcon, 
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

interface NotificationsProps {
  alerts?: string[];
}

const Notifications: React.FC<NotificationsProps> = ({ alerts = [] }) => {
  const [open, setOpen] = useState(false);
  const hasAlerts = alerts.length > 0;

  return (
    <Paper sx={{ p: 4, borderRadius: 1, border: '1px solid rgba(255, 255, 255, 0.08)', background: '#1a1a1a' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: open ? 3 : 0, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 48,
            height: 48,
            borderRadius: 0.5,
            background: hasAlerts ? 'rgba(255, 152, 0, 0.15)' : 'rgba(76, 175, 80, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${hasAlerts ? 'rgba(255, 152, 0, 0.3)' : 'rgba(76, 175, 80, 0.3)'}`,
          }}>
            <NotificationsIcon sx={{ fontSize: 28, color: hasAlerts ? '#FF9800' : '#4CAF50' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, fontSize: '1.1rem' }}>
              Benachrichtigungen
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.85rem' }}>
              {hasAlerts ? `${alerts.length} aktive Warnung${alerts.length > 1 ? 'en' : ''}` : 'Keine Warnungen'}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={hasAlerts ? <WarningIcon sx={{ fontSize: 14 }} /> : <CheckCircleIcon sx={{ fontSize: 14 }} />}
            label={hasAlerts ? 'Warnungen' : 'OK'}
            size="small"
            sx={{
              backgroundColor: hasAlerts ? 'rgba(255, 152, 0, 0.2)' : 'rgba(76, 175, 80, 0.2)',
              color: hasAlerts ? '#FF9800' : '#4CAF50',
              border: `1px solid ${hasAlerts ? 'rgba(255, 152, 0, 0.3)' : 'rgba(76, 175, 80, 0.3)'}`,
              fontWeight: 700,
              height: 24,
              fontSize: '0.7rem',
              '& .MuiChip-icon': { color: hasAlerts ? '#FF9800' : '#4CAF50' }
            }}
          />
          <IconButton sx={{ color: 'white' }}>
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={open}>
        <Stack spacing={3}>
          {hasAlerts ? (
            <Stack spacing={2}>
              {alerts.map((alert, index) => (
                <Alert 
                  key={index} 
                  severity="warning" 
                  sx={{ 
                    background: 'rgba(255, 152, 0, 0.1)',
                    border: '1px solid rgba(255, 152, 0, 0.3)',
                    color: 'white',
                    borderRadius: 0.5,
                    '& .MuiAlert-icon': { color: '#FF9800' }
                  }}
                >
                  {alert}
                </Alert>
              ))}
            </Stack>
          ) : (
            <Box sx={{ p: 4, borderRadius: 0.5, backgroundColor: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)', textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 48, color: '#4CAF50', mb: 2 }} />
              <Typography variant="h6" sx={{ color: 'white', mb: 1, fontWeight: 700 }}>
                Keine Benachrichtigungen
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                Alles läuft einwandfrei
              </Typography>
            </Box>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
};

export default Notifications;
