// src/components/FoodConsumptionOverview.tsx

import React from 'react';
import { Card, CardContent, Typography, Grid, Tooltip, useTheme } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

interface FoodConsumptionOverviewProps {
  dailyConsumption: number;    // in g
  weeklyConsumption: number;   // in g
  monthlyConsumption: number;  // in g
}

const FoodConsumptionOverview: React.FC<FoodConsumptionOverviewProps> = ({
  dailyConsumption,
  weeklyConsumption,
  monthlyConsumption,
}) => {
  const theme = useTheme();

  const renderCard = (
    label: string,
    value: number,
    tooltip: string,
    bgColor: string,
    iconColor: string,
    valueColor: string
  ) => (
    <Card
      sx={{
        textAlign: 'center',
        position: 'relative',
        minHeight: 140,
        padding: 2,
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
        borderRadius: 4,
        transition: 'transform 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
        },
      }}
    >
      <Tooltip title={tooltip} placement="top">
        <HelpOutlineIcon
          fontSize="small"
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            cursor: 'pointer',
            color: iconColor,
          }}
        />
      </Tooltip>
      <CardContent>
        <Typography variant="h6" sx={{ color: theme.palette.text.secondary }} gutterBottom>
          {label}
        </Typography>
        <Typography variant="h4" sx={{ color: value > 0 ? valueColor : theme.palette.text.disabled }}>
          {value > 0 ? `${value} g` : 'Noch keine Daten'}
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Grid container spacing={3} sx={{ mb: 2 }}>
      <Grid item xs={12} sm={4}>
        {renderCard(
          'Tägliche Futteraufnahme',
          dailyConsumption,
          'Die Menge an Futter, die deine Katze heute gegessen hat',
          '#e3f2fd',
          '#1976d2',
          theme.palette.primary.main
        )}
      </Grid>
      <Grid item xs={12} sm={4}>
        {renderCard(
          'Wöchentliche Futteraufnahme',
          weeklyConsumption,
          'Die Gesamtmenge an Futter, die deine Katze diese Woche gegessen hat',
          '#f1f8e9',
          '#388e3c',
          theme.palette.success.main
        )}
      </Grid>
      <Grid item xs={12} sm={4}>
        {renderCard(
          'Monatliche Futteraufnahme',
          monthlyConsumption,
          'Die Gesamtmenge an Futter, die deine Katze diesen Monat gegessen hat',
          '#fff3e0',
          '#f57c00',
          theme.palette.warning.main
        )}
      </Grid>
    </Grid>
  );
};

export default FoodConsumptionOverview;
