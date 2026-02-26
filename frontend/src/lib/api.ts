import axios from "axios";
import { API_URL } from "./utils";
import { logout, getToken } from "./auth";

const api = axios.create({
  baseURL: API_URL,
});

// Request interceptor — add JWT Bearer token
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — auto-logout on 401 (except on login page)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !window.location.pathname.startsWith("/login")
    ) {
      logout();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
