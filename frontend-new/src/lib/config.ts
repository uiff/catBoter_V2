export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://192.168.0.18:5000',
  wsEnabled: false,  // WebSocket deaktiviert - nutze REST API Polling
  refreshInterval: 2000, // 2 Sekunden Polling für Sensordaten
}
