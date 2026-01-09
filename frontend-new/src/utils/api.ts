/**
 * API utility functions with retry logic and error handling
 */

interface RetryOptions {
  maxRetries?: number
  retryDelay?: number
  backoff?: boolean
}

/**
 * Fetch with automatic retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    backoff = true
  } = retryOptions

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        return response
      }

      // Retry on 5xx errors (server errors) or network errors
      if (response.ok || attempt === maxRetries) {
        return response
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
    } catch (error) {
      lastError = error as Error

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break
      }
    }

    // Calculate delay with exponential backoff
    const delay = backoff ? retryDelay * Math.pow(2, attempt) : retryDelay

    console.warn(
      `Fetch failed (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`,
      lastError
    )

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  throw lastError || new Error('Max retries exceeded')
}

/**
 * POST request with retry logic
 */
export async function postWithRetry<T = any>(
  url: string,
  data: any,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(data),
      ...options
    },
    retryOptions
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || 'Request failed')
  }

  return response.json()
}

/**
 * GET request with retry logic
 */
export async function getWithRetry<T = any>(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, options, retryOptions)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || 'Request failed')
  }

  return response.json()
}

/**
 * Check if backend is reachable
 */
export async function checkBackendHealth(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/sensors`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Error types for better error handling
 */
export class NetworkError extends Error {
  constructor(message: string = 'Network error') {
    super(message)
    this.name = 'NetworkError'
  }
}

export class TimeoutError extends Error {
  constructor(message: string = 'Request timeout') {
    super(message)
    this.name = 'TimeoutError'
  }
}

export class ServerError extends Error {
  public status?: number

  constructor(message: string = 'Server error', status?: number) {
    super(message)
    this.name = 'ServerError'
    this.status = status
  }
}
