// SavedPlansList.tsx
import React from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Paper,
  Tooltip
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  PlayArrow as PlayArrowIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  CalendarToday as CalendarTodayIcon,
  Scale as ScaleIcon,
} from '@mui/icons-material';

interface FeedingTime {
  time: string;
  sound: boolean;
  weight: number;
  status: boolean | null;
}

interface FeedingPlan {
  planName: string;
  maxWeight: string;
  selectedDays: string[];
  feedingSchedule: { [key: string]: FeedingTime[] };
  active: boolean;
}

interface SavedPlansListProps {
  savedPlans: FeedingPlan[];
  loadedPlan: string | null;
  onLoadPlan: (planName: string) => void;
  onEditPlan: (index: number) => void;
  onDeletePlan: (index: number) => void;
}

const SavedPlansList: React.FC<SavedPlansListProps> = ({
  savedPlans,
  loadedPlan,
  onLoadPlan,
  onEditPlan,
  onDeletePlan
}) => {
  if (savedPlans.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body1" sx={{ color: 'white', opacity: 0.7, mb: 1 }}>
          Noch keine Pläne gespeichert
        </Typography>
        <Typography variant="body2" sx={{ color: 'white', opacity: 0.5 }}>
          Erstellen Sie Ihren ersten Fütterungsplan
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ 
        color: 'white', 
        fontWeight: 600, 
        mb: 3,
        opacity: 0.9,
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        <ScheduleIcon sx={{ fontSize: 24 }} />
        Gespeicherte Pläne
      </Typography>
      
      {savedPlans.map((plan, index) => {
        const isActive = loadedPlan === plan.planName;
        const totalFeedings = Object.values(plan.feedingSchedule).reduce(
          (acc, times) => acc + times.length, 
          0
        );
        
        return (
          <Paper
            key={index}
            className="glassmorphism-paper"
            sx={{
              mb: 2,
              p: 3,
              borderRadius: 1,
              border: isActive ? '2px solid #4CAF50' : '1px solid rgba(255, 255, 255, 0.2)',
              background: isActive 
                ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(139, 195, 74, 0.1) 100%)'
                : 'rgba(255, 255, 255, 0.05)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 24px rgba(33, 203, 243, 0.2)',
              }
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
              gap: 2
            }}>
              {/* Plan Info */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Typography variant="h6" sx={{ 
                    color: 'white',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {plan.planName}
                  </Typography>
                  {isActive && (
                    <Chip
                      icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                      label="Aktiv"
                      size="small"
                      sx={{
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        fontWeight: 600,
                        '& .MuiChip-icon': { color: 'white' }
                      }}
                    />
                  )}
                </Box>
                
                {/* Plan Details */}
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {plan.maxWeight && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ScaleIcon sx={{ fontSize: 16, color: '#21CBF3', opacity: 0.8 }} />
                      <Typography variant="body2" sx={{ color: 'white', opacity: 0.8 }}>
                        Max: <span style={{ color: '#21CBF3', fontWeight: 600 }}>{plan.maxWeight}g</span>
                      </Typography>
                    </Box>
                  )}
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CalendarTodayIcon sx={{ fontSize: 16, color: 'white', opacity: 0.6 }} />
                    <Typography variant="body2" sx={{ color: 'white', opacity: 0.8 }}>
                      {plan.selectedDays.length} Tage • {totalFeedings} Fütterungen
                    </Typography>
                  </Box>
                </Box>
                
                {/* Days Chips */}
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1.5, flexWrap: 'wrap' }}>
                  {plan.selectedDays.map((day) => (
                    <Chip
                      key={day}
                      label={day.substring(0, 2)}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        fontSize: '0.75rem',
                        height: 24
                      }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Actions */}
              <Box sx={{ 
                display: 'flex', 
                gap: 1,
                alignItems: 'center',
                flexShrink: 0
              }}>
                {!isActive && (
                  <Button
                    variant="contained"
                    onClick={() => onLoadPlan(plan.planName)}
                    startIcon={<PlayArrowIcon />}
                    sx={{
                      background: 'linear-gradient(135deg, #21CBF3 0%, #1BA8D1 100%)',
                      boxShadow: '0 4px 16px rgba(33, 203, 243, 0.3)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #1BA8D1 0%, #1690B5 100%)',
                        boxShadow: '0 6px 20px rgba(33, 203, 243, 0.4)',
                      },
                      minWidth: { xs: '100%', sm: 'auto' }
                    }}
                  >
                    Aktivieren
                  </Button>
                )}
                
                <Tooltip title="Plan bearbeiten">
                  <IconButton
                    onClick={() => onEditPlan(index)}
                    sx={{
                      color: 'white',
                      opacity: 0.8,
                      '&:hover': {
                        opacity: 1,
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      }
                    }}
                    aria-label={`Plan ${plan.planName} bearbeiten`}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Plan löschen">
                  <IconButton
                    onClick={() => onDeletePlan(index)}
                    sx={{
                      color: '#F44336',
                      opacity: 0.8,
                      '&:hover': {
                        opacity: 1,
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                      }
                    }}
                    aria-label={`Plan ${plan.planName} löschen`}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
};

export default SavedPlansList;