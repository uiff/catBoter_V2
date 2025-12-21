import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Card, CardContent, Typography, CircularProgress } from '@mui/material';
import axios from 'axios';
import config from '../../config';

// Chart.js Registrierung
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,    // Wichtig für Punkte auf der Linie
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

interface HistoricalData {
  time: string;
  value: number;
}

interface HistoricalDataChartProps {
  endpoint: string;
  title: string;
  label: string;
  color: string;
}

const HistoricalDataChart: React.FC<HistoricalDataChartProps> = ({
  endpoint,
  title,
  label,
  color,
}) => {
  const [dataPoints, setDataPoints] = useState<HistoricalData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        const now = new Date();
        const end = now.toISOString();
        const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(); // Letzte 24 Stunden

        const response = await axios.get<HistoricalData[]>(`${config.apiBaseUrl}${endpoint}`, {
          params: {
            start,
            end,
          },
        });

        if (response.data && response.data.length > 0) {
          setDataPoints(response.data);
        } else {
          setError('Keine Daten verfügbar.');
        }
      } catch (err) {
        console.error(`Fehler beim Abrufen der historischen Daten von ${endpoint}:`, err);
        setError(`Fehler beim Abrufen der historischen Daten von ${endpoint}.`);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalData();
  }, [endpoint]);

  if (loading) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography variant="h6">{title}</Typography>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography variant="h6">{title}</Typography>
          <Typography color="error">{error}</Typography>
        </CardContent>
      </Card>
    );
  }

  // Chart.js Daten und Optionen
  const chartData = {
    labels: dataPoints.map((point) =>
      new Date(point.time).toLocaleString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      })
    ),
    datasets: [
      {
        label: label,
        data: dataPoints.map((point) => point.value),
        fill: 'start',
        borderColor: color,
        backgroundColor: `${color}33`, // Transparente Fläche unter der Linie
        tension: 0.3, // Glättung der Linien
        pointRadius: 3, // Größe der Punkte
        pointBackgroundColor: color,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          autoSkip: true,
          maxTicksLimit: 12,
        },
        title: {
          display: true,
          text: 'Zeit',
        },
      },
      y: {
        title: {
          display: true,
          text: label,
        },
        beginAtZero: true,
      },
    },
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <div style={{ height: 300 }}>
          <Line data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  );
};

export default HistoricalDataChart;
