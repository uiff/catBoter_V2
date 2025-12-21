import React from 'react';
import { StepIconProps } from '@mui/material/StepIcon';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { styled } from '@mui/material/styles';

// Mapping der Schritte zu den entsprechenden Icons
const stepIcons: { [key: number]: React.ReactElement } = {
  1: <AssignmentIcon />,
  2: <CalendarTodayIcon />,
  3: <AccessTimeIcon />,
};

// Styled-Komponente für das Icon-Wrapper
const IconWrapper = styled('div')<{
  active?: boolean;
  completed?: boolean;
}>(({ theme, active, completed }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: active ? 36 : 28, // Größeres Icon für den aktiven Schritt
  color: completed
    ? theme.palette.success.main // Farbe für abgeschlossene Schritte
    : active
    ? theme.palette.primary.main // Farbe für aktive Schritte
    : theme.palette.grey[500], // Standardfarbe
  transition: 'all 0.3s ease', // Sanfte Animation beim Wechsel
}));

// StepIconComponent
const StepIconComponent: React.FC<StepIconProps> = (props) => {
  const { active, completed, icon } = props;
  const iconNumber = typeof icon === 'number' ? icon : parseInt(icon as string, 10);

  const Icon = stepIcons[iconNumber] || <div>{icon}</div>;

  return (
    <IconWrapper active={active} completed={completed}>
      {Icon}
    </IconWrapper>
  );
};

export default StepIconComponent;
