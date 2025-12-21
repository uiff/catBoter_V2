// SwaggerAPIDocumentation.tsx - Modern Dashboard Style mit Collapse
import React, { useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Typography, Box, Paper, IconButton, Chip, Collapse } from '@mui/material';
import { 
  Code as CodeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Api as ApiIcon
} from '@mui/icons-material';
import config from '../../config';

const SwaggerAPIDocumentation: React.FC = () => {
  const [open, setOpen] = useState(false);
  const url = `${config.apiBaseUrl}/api/swagger.yaml`;

  return (
    <Paper sx={{ p: 4, borderRadius: 1, border: '1px solid rgba(255, 255, 255, 0.08)', background: '#1a1a1a' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: open ? 3 : 0, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 48,
            height: 48,
            borderRadius: 0.5,
            background: 'rgba(139, 92, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }}>
            <CodeIcon sx={{ fontSize: 28, color: '#8b5cf6' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, fontSize: '1.1rem' }}>
              API Dokumentation
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.85rem' }}>
              Swagger UI Interface
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={<ApiIcon sx={{ fontSize: 14 }} />}
            label="Swagger"
            size="small"
            sx={{
              backgroundColor: 'rgba(139, 92, 246, 0.2)',
              color: '#8b5cf6',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              fontWeight: 700,
              height: 24,
              fontSize: '0.7rem',
              '& .MuiChip-icon': { color: '#8b5cf6' }
            }}
          />
          <IconButton sx={{ color: 'white' }}>
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={open}>
        <Box sx={{ 
          mt: 2,
          '& .swagger-ui': { 
            filter: 'invert(1) hue-rotate(180deg)',
            '& .info': {
              filter: 'invert(1) hue-rotate(180deg)'
            },
            '& .scheme-container': {
              background: 'transparent',
              boxShadow: 'none'
            }
          }
        }}>
          <SwaggerUI url={url} />
        </Box>
      </Collapse>
    </Paper>
  );
};

export default SwaggerAPIDocumentation;
