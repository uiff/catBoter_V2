// src/components/pages/Konfiguration.tsx - Modern & Clean mit Random Modus
import React, { useState } from 'react';
import { Box, Container, Stack, Paper, Typography, Tabs, Tab } from '@mui/material';
import { 
  Schedule as ScheduleIcon,
  Shuffle as ShuffleIcon,
} from '@mui/icons-material';
import FeedingPlan from '../settings/FeedingPlan';
import RandomFeedingMode from '../settings/RandomFeedingMode';
import WeightConfigComponent from '../sensorActor/WeightConfigComponent';
import '../../styles.css';

const Konfiguration: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', px: 0, py: { xs: 0, sm: 5 } }}>
      <Container maxWidth="md" disableGutters sx={{ px: { xs: 0, sm: 3 } }}>
        <Stack spacing={{ xs: 3, sm: 4 }}>
          {/* Tab Navigation */}
          <Paper sx={{ 
            p: { xs: 1.5, sm: 2 }, 
            borderRadius: { xs: 0, sm: 1 },
            border: { xs: 'none', sm: '1px solid rgba(255, 255, 255, 0.08)' },
            borderBottom: { xs: '1px solid rgba(255, 255, 255, 0.08)', sm: '1px solid rgba(255, 255, 255, 0.08)' },
            background: '#1a1a1a' 
          }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              variant="fullWidth"
              sx={{
                '& .MuiTabs-indicator': {
                  backgroundColor: '#06b6d4',
                  height: { xs: 2, sm: 3 },
                },
                '& .MuiTab-root': {
                  color: '#94a3b8',
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: { xs: '0.85rem', sm: '1rem' },
                  minHeight: { xs: 56, sm: 64 },
                  '&.Mui-selected': {
                    color: '#06b6d4',
                  },
                  '& .MuiSvgIcon-root': {
                    fontSize: { xs: '1.2rem', sm: '1.5rem' },
                  },
                },
              }}
            >
              <Tab 
                icon={<ScheduleIcon />} 
                iconPosition="start" 
                label="Auto Plan" 
              />
              <Tab 
                icon={<ShuffleIcon />} 
                iconPosition="start" 
                label="Random" 
              />
            </Tabs>
          </Paper>

          {/* Tab Content */}
          <Box sx={{ px: { xs: 0, sm: 0 } }}>
            {activeTab === 0 && <FeedingPlan />}
            {activeTab === 1 && <RandomFeedingMode />}
          </Box>
          
          <Box sx={{ px: { xs: 0, sm: 0 } }}>
            <WeightConfigComponent />
          </Box>
        </Stack>
      </Container>
    </Box>
  );
};

export default Konfiguration;
