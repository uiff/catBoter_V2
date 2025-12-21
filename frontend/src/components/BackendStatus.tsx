import React, { useEffect, useState } from 'react';
import {
  Box,
  Alert,
  AlertTitle,
  CircularProgress,
  Button,
  Typography,
  Collapse,
  LinearProgress,
} from '@mui/material';
import {
  CloudOff as CloudOffIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import config, { findWorkingBackend, checkBackendHealth } from '../config';

interface BackendStatusProps {
  onStatusChange?: (isOnline: boolean) => void;
}

const BackendStatus: React.FC<BackendStatusProps> = ({ onStatusChange }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [backendUrl, setBackendUrl] = useState(config.apiBaseUrl);
  const [showAlert, setShowAlert] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(true);

  const checkStatus = async () => {
    setIsChecking(true);
    
    try {
      // Versuche zuerst die aktuelle URL
      const healthy = await checkBackendHealth();
      
      if (healthy) {
        setIsOnline(true);
        setShowAlert(false);
        setBackendUrl(config.apiBaseUrl);
        onStatusChange?.(true);
        setRetryCount(0);
        return;
      }
      
      // Falls nicht erreichbar, suche nach Fallback
      console.log('Backend nicht erreichbar, suche nach Alternativen...');
      const workingBackend = await findWorkingBackend();
      
      if (workingBackend) {
        setIsOnline(true);
        setShowAlert(false);
        setBackendUrl(workingBackend);
        onStatusChange?.(true);
        setRetryCount(0);
      } else {
        setIsOnline(false);
        setShowAlert(true);
        onStatusChange?.(false);
      }
    } catch (error) {
      console.error('Backend-Status-Prüfung fehlgeschlagen:', error);
      setIsOnline(false);
      setShowAlert(true);
      onStatusChange?.(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    
    // Regelmäßige Prüfung alle 30 Sekunden wenn offline
    const interval = setInterval(() => {
      if (!isOnline && autoRetryEnabled) {
        setRetryCount(prev => prev + 1);
        checkStatus();
      } else if (isOnline) {
        // Auch bei Online-Status gelegentlich prüfen
        checkStatus();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isOnline, autoRetryEnabled]);

  const handleManualRetry = () => {
    setRetryCount(prev => prev + 1);
    checkStatus();
  };

  const handleDisableAutoRetry = () => {
    setAutoRetryEnabled(false);
    setShowAlert(false);
  };

  // Zeige nichts wenn Online
  if (isOnline && !isChecking) {
    return null;
  }

  // Zeige Ladeindikator beim ersten Check
  if (isChecking && retryCount === 0) {
    return (
      <Box sx={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(42, 42, 62, 0.95)',
        backdropFilter: 'blur(10px)',
      }}>
        <LinearProgress 
          sx={{
            '& .MuiLinearProgress-bar': {
              background: 'linear-gradient(45deg, #21CBF3 30%, #667eea 90%)',
            }
          }}
        />
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: 2,
          p: 2,
        }}>
          <CircularProgress size={20} sx={{ color: '#21CBF3' }} />
          <Typography sx={{ color: 'white', fontSize: '0.9rem' }}>
            Verbinde mit Backend...
          </Typography>
        </Box>
      </Box>
    );
  }

  // Zeige Fehler-Alert wenn offline
  return (
    <Collapse in={showAlert}>
      <Box sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        p: { xs: 1, sm: 2 },
      }}>
        <Alert 
          severity="error"
          icon={<CloudOffIcon />}
          sx={{
            background: 'linear-gradient(135deg, #F44336 0%, #D32F2F 100%)',
            color: 'white',
            boxShadow: '0 8px 32px rgba(244, 67, 54, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(15px)',
            '& .MuiAlert-icon': {
              color: 'white',
            },
          }}
          action={
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {isChecking && (
                <CircularProgress size={20} sx={{ color: 'white' }} />
              )}
              <Button
                color="inherit"
                size="small"
                onClick={handleManualRetry}
                disabled={isChecking}
                startIcon={<RefreshIcon />}
                sx={{
                  color: 'white',
                  borderColor: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                Erneut versuchen
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={handleDisableAutoRetry}
                sx={{
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                Schließen
              </Button>
            </Box>
          }
        >
          <AlertTitle sx={{ fontWeight: 700 }}>
            Backend nicht erreichbar
          </AlertTitle>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Die Verbindung zum CatBot-Backend konnte nicht hergestellt werden.
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            Versucht: {backendUrl}
            {retryCount > 0 && ` (${retryCount} Versuche)`}
          </Typography>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, mb: 0.5 }}>
              <WarningIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'text-bottom' }} />
              Mögliche Ursachen:
            </Typography>
            <Typography variant="caption" component="ul" sx={{ opacity: 0.8, pl: 2, mb: 0 }}>
              <li>Raspberry Pi ist ausgeschaltet oder nicht im Netzwerk</li>
              <li>Backend-Server läuft nicht (python3 backend/main.py)</li>
              <li>Firewall blockiert Port 5000</li>
              <li>IP-Adresse hat sich geändert</li>
            </Typography>
          </Box>
        </Alert>
      </Box>
    </Collapse>
  );
};

export default BackendStatus;
