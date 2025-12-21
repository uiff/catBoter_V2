// Intelligente Backend-URL-Erkennung
const getApiBaseUrl = (): string => {
  // 1. Prüfe ob im Development-Modus (localhost)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Versuche verschiedene bekannte Raspberry Pi IPs
    const knownRaspberryIPs = [
      'http://192.168.1.182:5000',
      'http://raspberrypi.local:5000',
      'http://catbot.local:5000'
    ];
    
    // Verwende die erste bekannte IP als Fallback
    return knownRaspberryIPs[0];
  }
  
  // 2. Wenn Frontend vom gleichen Server bereitgestellt wird (Production)
  // Verwende relative URL
  if (window.location.port === '3000') {
    // Development Server auf Port 3000
    // Versuche Backend auf dem gleichen Host zu erreichen
    return `http://${window.location.hostname}:5000`;
  }
  
  // 3. Production: Backend auf gleichem Host
  // Wenn Frontend auf Port 80/443 läuft, ist Backend auf Port 5000
  return `http://${window.location.hostname}:5000`;
};

// API-Konfiguration mit dynamischer URL
const config = {
  apiBaseUrl: getApiBaseUrl(),
  timeout: 10000, // 10 Sekunden Timeout
  retryAttempts: 3,
  retryDelay: 1000, // 1 Sekunde zwischen Versuchen
  
  // Fallback-URLs falls primäre URL nicht erreichbar
  fallbackUrls: [
    'http://raspberrypi.local:5000',
    'http://catbot.local:5000',
    'http://192.168.1.182:5000',
    // Fügen Sie weitere mögliche IPs hinzu
  ]
};

// Health-Check Funktion
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${config.apiBaseUrl}/health`, {
      signal: controller.signal,
      method: 'GET',
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('Backend health check failed:', error);
    return false;
  }
};

// Versuche Fallback-URLs
export const findWorkingBackend = async (): Promise<string | null> => {
  console.log('Suche nach erreichbarem Backend...');
  
  // Versuche zuerst die primäre URL
  const primaryHealthy = await checkBackendHealth();
  if (primaryHealthy) {
    console.log('✅ Backend erreichbar:', config.apiBaseUrl);
    return config.apiBaseUrl;
  }
  
  // Versuche Fallback-URLs
  for (const url of config.fallbackUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${url}/health`, {
        signal: controller.signal,
        method: 'GET',
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('✅ Backend gefunden:', url);
        // Aktualisiere die Konfiguration
        config.apiBaseUrl = url;
        return url;
      }
    } catch (error) {
      console.warn(`Fallback-URL ${url} nicht erreichbar:`, error);
    }
  }
  
  console.error('❌ Kein erreichbares Backend gefunden');
  return null;
};

// Exportiere Konfiguration
export default config;

// Helfer-Funktion für API-Aufrufe mit automatischem Retry
export const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < config.retryAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);
      
      const response = await fetch(`${config.apiBaseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      lastError = error as Error;
      console.warn(`API-Aufruf Versuch ${attempt + 1} fehlgeschlagen:`, error);
      
      if (attempt < config.retryAttempts - 1) {
        // Warte vor erneutem Versuch
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        
        // Versuche Fallback-Backend zu finden
        if (attempt === 1) {
          await findWorkingBackend();
        }
      }
    }
  }
  
  throw lastError || new Error('API-Aufruf fehlgeschlagen');
};

// Logging für Debugging
console.log('🔧 Backend-Konfiguration:');
console.log('Primary URL:', config.apiBaseUrl);
console.log('Fallback URLs:', config.fallbackUrls);
