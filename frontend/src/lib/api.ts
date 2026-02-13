import axios from 'axios';
import { API_URL } from './utils';
import { logout, getCurrentAccount } from './auth';

const api = axios.create({
  baseURL: API_URL,
});

// Request interceptor to check session expiration and add account_id
api.interceptors.request.use(
  (config) => {
    const account = getCurrentAccount();
    if (account) {
      const sessionStart = localStorage.getItem('key-session-start-time');
      if (sessionStart) {
        const sessionTimeout = account.session_timeout_seconds || 3600;
        const sessionStartTime = parseInt(sessionStart);
        const endTime = sessionStartTime + (sessionTimeout * 1000);
        const now = Date.now();
        
        if (now >= endTime) {
          // Session expired - cancel request and logout
          logout();
          window.location.href = '/login';
          return Promise.reject(new Error('Session expired'));
        }
      }
      
      // Add account_id to all requests
      if (config.method === 'get' || config.method === 'delete') {
        config.params = { ...config.params, account_id: account.id };
      } else if (config.method === 'post' || config.method === 'put') {
        config.data = { ...config.data, account_id: account.id };
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if session expired (401 or specific error message)
    if (error.response?.status === 401 || error.response?.data?.error?.toLowerCase().includes('session expired')) {
      const account = getCurrentAccount();
      if (account) {
        logout();
        // Redirect to login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
