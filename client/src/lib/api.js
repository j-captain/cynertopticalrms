import axios from 'axios';

const API_ORIGIN =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  // eslint-disable-next-line no-console
  console.error(
    '❌ VITE_API_URL is not set in the production build. ' +
    'Set it in Vercel → Settings → Environment Variables, then redeploy.'
  );
}

const api = axios.create({
  // Your route calls are '/auth/login', '/patients', etc.
  // The backend mounts everything under '/api', so we add it here once.
  baseURL: `${API_ORIGIN}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cynert_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      err.response?.status === 401 &&
      !err.config?.url?.includes('/auth/login')
    ) {
      localStorage.removeItem('cynert_token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;