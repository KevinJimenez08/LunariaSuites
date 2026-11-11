import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Adjunta el token de sesión a las peticiones del panel sin alterar las llamadas existentes.
const fetchOriginal = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  let token = localStorage.getItem('lunariaToken');
  if (!token || token === 'undefined' || token === 'null') {
    try {
      const sesion = JSON.parse(localStorage.getItem('lunariaSesion') || 'null');
      token = sesion?.token || sesion?.usuario?.token || '';
      if (token) localStorage.setItem('lunariaToken', token);
    } catch { token = ''; }
  }
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  return fetchOriginal(input, { ...init, headers });
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
