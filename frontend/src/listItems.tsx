import * as React from 'react';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsIcon from '@mui/icons-material/Settings';
import MonitorIcon from '@mui/icons-material/Monitor';
import TuneIcon from '@mui/icons-material/Tune';
import { Link } from 'react-router-dom';

export const mainListItems = (
  <div>
    <ListItem button component={Link} to="/">
      <ListItemIcon>
        <DashboardIcon />
      </ListItemIcon>
      <ListItemText primary="Dashboard" />
    </ListItem>
    <ListItem button component={Link} to="/monitoring">
      <ListItemIcon>
        <MonitorIcon />
      </ListItemIcon>
      <ListItemText primary="Monitoring" />
    </ListItem>
    <ListItem button component={Link} to="/konfiguration">
      <ListItemIcon>
        <TuneIcon />
      </ListItemIcon>
      <ListItemText primary="Konfiguration" />
    </ListItem>
    <ListItem button component={Link} to="/einstellungen">
      <ListItemIcon>
        <SettingsIcon />
      </ListItemIcon>
      <ListItemText primary="Einstellungen" />
    </ListItem>
  </div>
);
