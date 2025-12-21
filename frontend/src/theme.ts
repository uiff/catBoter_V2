// Zentrales Theme-System für CatBoter V3 - Modern Design
import { createTheme, ThemeOptions } from '@mui/material/styles';

// Moderne Farbpalette - Minimalistisch & Clean
export const colors = {
  // Primärfarben - Türkis/Cyan
  primary: {
    main: '#06b6d4', // Modern Cyan
    light: '#22d3ee',
    dark: '#0891b2',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  },
  
  // Sekundärfarben - Purple/Violet
  secondary: {
    main: '#8b5cf6', // Modern Violet
    light: '#a78bfa',
    dark: '#7c3aed',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  },
  
  // Status-Farben
  success: {
    main: '#4CAF50',
    light: '#81C784',
    dark: '#388E3C',
    gradient: 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)',
  },
  
  warning: {
    main: '#FF9800',
    light: '#FFB74D',
    dark: '#F57C00',
    gradient: 'linear-gradient(135deg, #FF9800 0%, #FFC107 100%)',
  },
  
  error: {
    main: '#F44336',
    light: '#E57373',
    dark: '#D32F2F',
    gradient: 'linear-gradient(135deg, #F44336 0%, #E91E63 100%)',
  },
  
  info: {
    main: '#2196F3',
    light: '#64B5F6',
    dark: '#1976D2',
    gradient: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
  },
  
  // Neutrale Farben - Modern Grayscale
  neutral: {
    white: '#FFFFFF',
    black: '#000000',
    gray50: '#f8fafc',
    gray100: '#f1f5f9',
    gray200: '#e2e8f0',
    gray300: '#cbd5e1',
    gray400: '#94a3b8',
    gray500: '#64748b',
    gray600: '#475569',
    gray700: '#334155',
    gray800: '#1e293b',
    gray900: '#0f172a',
  },
  
  // Hintergrund-Farben - Dunkel & Modern
  background: {
    default: '#0a0a0a', // Sehr dunkel für modernen Look
    paper: '#1a1a1a',    // Etwas heller für Cards
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    dark: '#050505',
    elevated: '#252525', // Für erhöhte Elemente
  },
};

// Spacing-System (basierend auf 8px Grid)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border-Radius System
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 9999,
};

// Schatten-System
export const shadows = {
  sm: '0 2px 8px rgba(0, 0, 0, 0.1)',
  md: '0 4px 16px rgba(0, 0, 0, 0.15)',
  lg: '0 8px 32px rgba(0, 0, 0, 0.2)',
  xl: '0 12px 48px rgba(0, 0, 0, 0.25)',
  
  // Farbige Schatten
  primary: '0 8px 32px rgba(33, 203, 243, 0.3)',
  success: '0 8px 32px rgba(76, 175, 80, 0.3)',
  warning: '0 8px 32px rgba(255, 152, 0, 0.3)',
  error: '0 8px 32px rgba(244, 67, 54, 0.3)',
  
  // Glasmorphism
  glass: '0 8px 32px rgba(0, 0, 0, 0.1)',
};

// Moderne Card-Styles (weniger Glassmorphism, mehr Solid)
export const cardStyles = {
  paper: {
    background: '#1a1a1a',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.lg,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
  },
  
  card: {
    background: '#1a1a1a',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: borderRadius.lg,
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.3)',
  },
  
  elevated: {
    background: '#252525',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.lg,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  },
  
  // Optional: Subtiler Glassmorphism nur für Overlays
  glass: {
    background: 'rgba(26, 26, 26, 0.8)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.lg,
  },
};

// Transitions
export const transitions = {
  fast: '0.15s ease',
  normal: '0.3s ease',
  slow: '0.5s ease',
  
  // Spezifische Transitions
  all: 'all 0.3s ease',
  transform: 'transform 0.3s ease',
  opacity: 'opacity 0.3s ease',
  background: 'background 0.3s ease',
  color: 'color 0.3s ease',
  boxShadow: 'box-shadow 0.3s ease',
};

// Breakpoints
export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 960,
  lg: 1280,
  xl: 1920,
};

// Moderne Typografie mit stärkerer Hierarchie
export const typography = {
  fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
  
  // Font Sizes mit klarerer Hierarchie
  h1: { fontSize: '3rem', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' },
  h2: { fontSize: '2.25rem', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.01em' },
  h3: { fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.2 },
  h4: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3 },
  h5: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
  h6: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
  
  body1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.6 },
  body2: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.6 },
  
  caption: { fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.4 },
  button: { fontSize: '0.9375rem', fontWeight: 600, textTransform: 'none' as const, letterSpacing: '0.01em' },
};

// Material-UI Theme
const themeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: colors.primary.main,
      light: colors.primary.light,
      dark: colors.primary.dark,
    },
    secondary: {
      main: colors.secondary.main,
      light: colors.secondary.light,
      dark: colors.secondary.dark,
    },
    success: {
      main: colors.success.main,
      light: colors.success.light,
      dark: colors.success.dark,
    },
    warning: {
      main: colors.warning.main,
      light: colors.warning.light,
      dark: colors.warning.dark,
    },
    error: {
      main: colors.error.main,
      light: colors.error.light,
      dark: colors.error.dark,
    },
    info: {
      main: colors.info.main,
      light: colors.info.light,
      dark: colors.info.dark,
    },
    background: {
      default: colors.background.default,
      paper: colors.background.paper,
    },
    text: {
      primary: colors.neutral.white,
      secondary: colors.neutral.gray800,
    },
  },
  
  typography: {
    fontFamily: typography.fontFamily,
    h1: typography.h1,
    h2: typography.h2,
    h3: typography.h3,
    h4: typography.h4,
    h5: typography.h5,
    h6: typography.h6,
    body1: typography.body1,
    body2: typography.body2,
    caption: typography.caption,
    button: typography.button,
  },
  
  shape: {
    borderRadius: borderRadius.md,
  },
  
  spacing: 8,
  
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.md,
          textTransform: 'none',
          fontWeight: 600,
          padding: '12px 24px',
          minHeight: 48,
          transition: transitions.all,
          '&:hover': {
            transform: 'translateY(-2px)',
          },
        },
        contained: {
          boxShadow: shadows.md,
          '&:hover': {
            boxShadow: shadows.lg,
          },
        },
        containedPrimary: {
          background: colors.primary.gradient,
        },
        containedSuccess: {
          background: colors.success.gradient,
        },
        containedError: {
          background: colors.error.gradient,
        },
      },
    },
    
    MuiPaper: {
      styleOverrides: {
        root: {
          ...cardStyles.paper,
        },
      },
    },
    
    MuiCard: {
      styleOverrides: {
        root: {
          ...cardStyles.card,
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.12)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
          },
        },
      },
    },
    
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            background: '#1a1a1a',
            borderRadius: borderRadius.md,
            transition: transitions.all,
            '&:hover': {
              background: '#252525',
            },
            '&.Mui-focused': {
              background: '#252525',
            },
          },
          '& .MuiInputLabel-root': {
            color: colors.neutral.gray400,
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.1)',
          },
        },
      },
    },
    
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: borderRadius.sm,
        },
      },
    },
    
    MuiAccordion: {
      styleOverrides: {
        root: {
          ...cardStyles.paper,
          marginBottom: spacing.md,
          '&:before': {
            display: 'none',
          },
        },
      },
    },
    
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 48,
          minHeight: 48,
          transition: transitions.all,
          '&:active': {
            transform: 'scale(0.95)',
          },
        },
      },
    },
    
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 8,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.neutral.gray200,
        },
        bar: {
          borderRadius: borderRadius.sm,
        },
      },
    },
  },
};

// Erstelle Theme
export const theme = createTheme(themeOptions);

// Export aller Theme-Utilities
export default {
  theme,
  colors,
  spacing,
  borderRadius,
  shadows,
  cardStyles,
  transitions,
  breakpoints,
  typography,
};
