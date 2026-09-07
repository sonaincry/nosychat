import axios from 'axios';


export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5279'; 

const axiosClient = axios.create({
  baseURL: `${API_BASE_URL}/api`, 
});

axiosClient.interceptors.request.use((config) => {
  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    const user = JSON.parse(savedUser);
    if (user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
  }
  return config;
});

export default axiosClient;