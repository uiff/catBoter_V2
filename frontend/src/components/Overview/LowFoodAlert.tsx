// src/components/LowFoodAlert.tsx

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  useTheme,
} from '@mui/material';

interface LowFoodAlertProps {
  open: boolean;
  onAcknowledge: () => void;
  onSnooze: () => void;
}

const LowFoodAlert: React.FC<LowFoodAlertProps> = ({ open, onAcknowledge, onSnooze }) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onSnooze}
      PaperProps={{
        sx: {
          borderRadius: 6,
          background: 'rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
          color: 'white',
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 'bold', color: theme.palette.primary.light }}>
        Futterstand niedrig
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: theme.palette.text.secondary }}>
          Der Füllstand des Futternapfs liegt unter 10%. Bitte fülle das Futter nach, um sicherzustellen,
          dass deine Katze ausreichend versorgt ist.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onSnooze} color="secondary" variant="outlined">
          Später
        </Button>
        <Button onClick={onAcknowledge} color="primary" variant="contained" autoFocus>
          Nachgefüllt
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LowFoodAlert;
