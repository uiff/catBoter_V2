import * as React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { LineChart } from '@mui/x-charts/LineChart';
import Typography from '@mui/material/Typography';
import TimelineIcon from '@mui/icons-material/Timeline';

interface ChartComponentProps {
  data: number[];
  title: string;
  unit?: string;
  color?: string;
}

const ChartComponent: React.FC<ChartComponentProps> = ({ 
  data, 
  title, 
  unit = '',
  color = '#21CBF3' 
}) => {
  const latestValue = data[data.length - 1] || 0;

  return (
    <Paper 
      className="glassmorphism-paper" 
      sx={{ 
        p: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <TimelineIcon sx={{ fontSize: 28, color: 'white', opacity: 0.9 }} />
        <Typography variant="h6" sx={{ 
          color: 'white', 
          fontWeight: 600,
          opacity: 0.9
        }}>
          {title}
        </Typography>
      </Box>

      <Box sx={{ 
        width: '100%', 
        height: '250px', 
        position: 'relative',
        flex: 1,
        minHeight: 250
      }}>
        <LineChart
          xAxis={[{ 
            data: data.map((_, index) => index),
            scaleType: 'point',
            tickLabelStyle: {
              fill: 'rgba(255, 255, 255, 0.7)',
              fontSize: 12
            }
          }]}
          yAxis={[{
            tickLabelStyle: {
              fill: 'rgba(255, 255, 255, 0.7)',
              fontSize: 12
            }
          }]}
          series={[{ 
            data, 
            area: true,
            color: color,
            showMark: false,
            curve: 'monotoneX'
          }]}
          width={500}
          height={250}
          sx={{
            '& .MuiChartsAxis-line': { 
              stroke: 'rgba(255, 255, 255, 0.2)' 
            },
            '& .MuiChartsAxis-tick': { 
              stroke: 'rgba(255, 255, 255, 0.2)' 
            },
            '& .MuiChartsGrid-line': { 
              stroke: 'rgba(255, 255, 255, 0.1)' 
            },
            '& .MuiAreaElement-root': {
              fillOpacity: 0.3,
              filter: `drop-shadow(0 4px 20px ${color}40)`
            },
            '& .MuiLineElement-root': {
              strokeWidth: 3,
              filter: `drop-shadow(0 0 10px ${color}60)`
            }
          }}
          margin={{ left: 50, right: 20, top: 20, bottom: 30 }}
          grid={{ horizontal: true, vertical: false }}
        />
        
        {/* Aktueller Wert Overlay */}
        <Box sx={{ 
          position: 'absolute', 
          top: 20, 
          right: 20, 
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          padding: 2,
          borderRadius: 0.5,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          minWidth: 100,
          textAlign: 'center'
        }}>
          <Typography variant="caption" sx={{ 
            color: 'white', 
            opacity: 0.7,
            display: 'block',
            mb: 0.5
          }}>
            Aktuell
          </Typography>
          <Typography variant="h4" sx={{ 
            color: color,
            fontWeight: 700,
            textShadow: `0 0 20px ${color}60`,
            lineHeight: 1
          }}>
            {latestValue.toFixed(1)}
          </Typography>
          {unit && (
            <Typography variant="body2" sx={{ 
              color: 'white', 
              opacity: 0.8,
              mt: 0.5
            }}>
              {unit}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default ChartComponent;