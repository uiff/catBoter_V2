// src/components/charts/GaugeComponent.tsx

import * as React from 'react';
import Box from '@mui/material/Box';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import Typography from '@mui/material/Typography';

interface GaugeComponentProps {
  value: number;
  title: string;
  unit?: string;
  thresholds?: { value: number; color: string }[];
  size?: 'small' | 'medium' | 'large';
  hideTitle?: boolean;
}

const GaugeComponent: React.FC<GaugeComponentProps> = ({
  value,
  title,
  unit = '',
  thresholds = [{ value: 50, color: '#667eea' }],
  size = 'medium',
  hideTitle = false,
}) => {
  // Größen-Konfiguration
  const sizeConfig = {
    small: { gauge: 140, container: 160, valueText: 'h4' as const, unitText: 'body1' as const },
    medium: { gauge: 180, container: 200, valueText: 'h3' as const, unitText: 'h6' as const },
    large: { gauge: 220, container: 240, valueText: 'h2' as const, unitText: 'h5' as const },
  };

  const config = sizeConfig[size];

  // Funktion zur Bestimmung der Farbe basierend auf Schwellenwerten
  const getGaugeColor = (val: number): string => {
    // Spezielle Farben für bestimmte Titel
    if (title === 'Gewicht' || title === 'Gewicht Futternapf' || title === 'Aktuelles Gewicht') {
      return '#21CBF3'; // Immer Cyan für Gewicht
    }
    
    // Standard-Schwellenwert-Logik für andere Gauges
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (val >= thresholds[i].value) {
        return thresholds[i].color;
      }
    }
    return '#667eea';
  };

  const gaugeColor = getGaugeColor(value);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        p: 2,
      }}
    >
      {!hideTitle && (
        <Typography 
          variant="h6" 
          sx={{ 
            color: 'white', 
            fontWeight: 600,
            mb: 1,
            opacity: 0.9,
            fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' }
          }}
        >
          {title}
        </Typography>
      )}
      
      <Box
        sx={{
          width: config.container,
          height: config.container,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Gauge
          width={config.gauge}
          height={config.gauge}
          value={value}
          cornerRadius="50%"
          sx={{
            [`& .${gaugeClasses.valueText}`]: {
              display: 'none',
            },
            [`& .${gaugeClasses.valueArc}`]: {
              fill: gaugeColor,
              filter: `drop-shadow(0 0 15px ${gaugeColor}60)`,
            },
            [`& .${gaugeClasses.referenceArc}`]: {
              fill: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        />
        
        {/* Zentraler Wert */}
        <Box
          sx={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography 
            variant={config.valueText}
            component="div" 
            sx={{ 
              color: gaugeColor,
              fontWeight: 700,
              textShadow: `0 0 25px ${gaugeColor}80`,
              lineHeight: 1,
              fontSize: size === 'small' ? '2rem' : size === 'medium' ? '2.5rem' : '3rem'
            }}
          >
            {value.toFixed(value % 1 === 0 ? 0 : 1)}
          </Typography>
          {unit && (
            <Typography 
              variant={config.unitText}
              sx={{ 
                color: 'white',
                opacity: 0.8,
                fontWeight: 500,
                mt: 0.5,
                fontSize: size === 'small' ? '0.875rem' : size === 'medium' ? '1rem' : '1.25rem'
              }}
            >
              {unit}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default GaugeComponent;