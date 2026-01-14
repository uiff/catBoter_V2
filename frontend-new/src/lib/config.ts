export const config = {
  // Verwendet relative URL damit Reverse Proxy funktioniert
  // Frontend und Backend werden über nginx auf Port 80 bereitgestellt
  // Im Dev-Mode: Vite Proxy nutzen (/api → Backend:5000)
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  wsEnabled: true,  // WebSocket aktiviert - Echtzeit-Sensor-Updates!
  refreshInterval: 3000, // 3 Sekunden Fallback-Polling falls WebSocket fehlschlägt
}
