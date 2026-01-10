export const config = {
  // Verwendet relative URL damit Reverse Proxy funktioniert
  // Frontend und Backend werden über nginx auf Port 80 bereitgestellt
  // Im Dev-Mode: Vite Proxy nutzen (/api → Backend:5000)
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  wsEnabled: false,  // WebSocket deaktiviert - nutze REST API Polling
  refreshInterval: 500, // 500ms Polling für schnelle Updates (2Hz)
}
