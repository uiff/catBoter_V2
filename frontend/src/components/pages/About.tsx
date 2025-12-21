// src/components/pages/About.tsx - Modern & Clean
import React from 'react';
import { Box, Container, Paper, Typography, Link, Divider } from '@mui/material';
import { Info as InfoIcon, Pets as PetsIcon, Code as CodeIcon } from '@mui/icons-material';
import '../../styles.css';

const About: React.FC = () => {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', px: 0, py: { xs: 0, sm: 5 } }}>
      <Container maxWidth="md" disableGutters sx={{ px: { xs: 0, sm: 3 } }}>
        <Paper sx={{ 
          p: { xs: 2.5, sm: 4 }, 
          borderRadius: { xs: 0, sm: 1 }, 
          border: { xs: 'none', sm: '1px solid rgba(255, 255, 255, 0.08)' },
          background: '#1a1a1a' 
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 }, mb: { xs: 3, sm: 4 } }}>
              <Box sx={{
                width: { xs: 48, sm: 56 },
                height: { xs: 48, sm: 56 },
                borderRadius: { xs: 2, sm: 3 },
                background: 'rgba(6, 182, 212, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(6, 182, 212, 0.3)',
              }}>
                <PetsIcon sx={{ fontSize: 32, color: '#06b6d4' }} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, fontSize: { xs: '1.2rem', sm: '1.5rem' } }}>catBoter V3</Typography>
                <Typography variant="body2" sx={{ color: '#64748b', fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Smart Cat Feeder System</Typography>
              </Box>
            </Box>

            <Divider sx={{ my: { xs: 2, sm: 3 }, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Typography variant="body1" sx={{ color: '#cbd5e1', lineHeight: 1.8, mb: { xs: 2, sm: 3 }, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              Entwickelt aus einer tiefen Leidenschaft für das Wohlbefinden unserer tierischen Freunde – eine Fusion aus fortschrittlicher Technologie und purer Liebe zu Tieren. Nach jahrelanger Forschung und Entwicklung, in die Ueli sein umfangreiches Wissen und seine Begeisterung für Digitalisierung eingebracht hat, ist dieser Futterspender mehr als nur ein Produkt; er ist ein echter Lebensverbesserer für Katzen und ihre Besitzer.
            </Typography>

            <Typography variant="body1" sx={{ color: '#cbd5e1', lineHeight: 1.8, mb: { xs: 2, sm: 3 }, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              Unser Futterspender garantiert nicht nur eine gesunde, bedarfsgerechte Ernährung Ihrer Katze zu jeder Tages- und Nachtzeit, sondern bietet auch eine benutzerfreundliche Oberfläche, die Ihnen die Kontrolle gibt, unabhängig von Ihrem Standort.
            </Typography>

            <Typography variant="body1" sx={{ color: '#cbd5e1', lineHeight: 1.8, mb: { xs: 3, sm: 4 }, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              Der von Ueli Iff entwickelte Katzenfutterspender ist mehr als nur ein einfacher Automat; es ist ein Versprechen für eine gesündere, glücklichere Katze. Vertrauen Sie auf die Kombination aus Fachwissen und Fürsorge.
            </Typography>

            <Divider sx={{ my: { xs: 2, sm: 3 }, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Box sx={{ mb: { xs: 3, sm: 4 } }}>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1.5, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                <InfoIcon sx={{ fontSize: { xs: 20, sm: 24 }, color: '#06b6d4' }} />
                Features
              </Typography>
              <Box component="ul" sx={{ color: '#cbd5e1', pl: 2, fontSize: { xs: '0.9rem', sm: '1rem' }, '& li': { mb: 1 } }}>
                <li>Automatische Fütterung nach Zeitplan</li>
                <li>Gewichtsüberwachung in Echtzeit</li>
                <li>Füllstandskontrolle des Futtertanks</li>
                <li>System-Monitoring und Statistiken</li>
                <li>Fernsteuerung über Web-Interface</li>
                <li>Benachrichtigungen bei niedrigem Futterstand</li>
              </Box>
            </Box>

            <Divider sx={{ my: { xs: 2, sm: 3 }, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Box sx={{ 
              p: { xs: 2, sm: 3 }, 
              borderRadius: { xs: 1.5, sm: 2 }, 
              backgroundColor: 'rgba(6, 182, 212, 0.1)', 
              border: '1px solid rgba(6, 182, 212, 0.3)' 
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <CodeIcon sx={{ fontSize: { xs: 20, sm: 24 }, color: '#06b6d4' }} />
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.25rem' } }}>Entwickelt von</Typography>
              </Box>
              <Typography variant="body1" sx={{ color: '#cbd5e1', mb: 1, fontSize: { xs: '0.9rem', sm: '1rem' } }}>Ueli Iff</Typography>
              <Link
                href="http://www.iotueli.ch"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: '#06b6d4',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.1rem' },
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  '&:hover': { color: '#22d3ee', textDecoration: 'underline' }
                }}
              >
                www.iotueli.ch
              </Link>
            </Box>

            <Box sx={{ mt: { xs: 3, sm: 4 }, pt: { xs: 2, sm: 3 }, borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                catBoter V3 © 2024 • Smart Cat Feeder System
              </Typography>
            </Box>
          </Paper>
      </Container>
    </Box>
  );
};

export default About;
