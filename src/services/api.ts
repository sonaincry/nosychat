import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5279'; 

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

// Tự động gắn JWT Token vào mọi Request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;