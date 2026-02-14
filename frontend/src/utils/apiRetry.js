import axios from 'axios';

/**
 * Retry logic for API calls with exponential backoff
 */
export const retryApiCall = async (apiFunction, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiFunction();
      return result;
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain status codes
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`API call failed, retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Enhanced axios instance with retry logic
 */
export const createApiClient = (baseURL, retryConfig = {}) => {
  const client = axios.create({
    baseURL,
    timeout: 30000,
    ...retryConfig
  });

  // Add request interceptor for logging
  client.interceptors.request.use(
    (config) => {
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Add response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === 'ECONNABORTED') {
        console.error('Request timeout');
      } else if (!error.response) {
        console.error('Network error - server may be down');
      }
      return Promise.reject(error);
    }
  );

  return client;
};

/**
 * Check if user is online
 */
export const isOnline = () => {
  return navigator.onLine;
};

/**
 * Wait for network connection
 */
export const waitForConnection = (timeout = 10000) => {
  return new Promise((resolve, reject) => {
    if (navigator.onLine) {
      resolve(true);
      return;
    }

    const checkOnline = () => {
      if (navigator.onLine) {
        window.removeEventListener('online', checkOnline);
        clearTimeout(timeoutId);
        resolve(true);
      }
    };

    const timeoutId = setTimeout(() => {
      window.removeEventListener('online', checkOnline);
      reject(new Error('Network connection timeout'));
    }, timeout);

    window.addEventListener('online', checkOnline);
  });
};
