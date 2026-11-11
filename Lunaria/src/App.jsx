import { useEffect, useState } from 'react';
import GestionRoles from './GestionRoles.jsx';
import ClienteHotel from './ClienteHotel.jsx';
import AccesoHotel from './AccesoHotel.jsx';
import GestionComentarios from './GestionComentarios.jsx';
import './App.css';

const leerSesion = () => {
  try {
    const sesion = JSON.parse(localStorage.getItem('lunariaSesion') || 'null');
    const token = sesion?.token || sesion?.usuario?.token;
    if (token && !localStorage.getItem('lunariaToken')) localStorage.setItem('lunariaToken', token);
    return sesion;
  } catch { return null; }
};
const normalizarPermiso = (valor = '') => String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const usuarioEsCliente = (usuario) => Number(usuario?.idRolesFK) === 4 || normalizarPermiso(usuario?.Rol) === 'cliente';
const tienePermisosAdmin = (usuario) => {
  if (!usuario) return false;
  const rol = normalizarPermiso(usuario.Rol);
  if (Number(usuario.idRolesFK) === 1 || (['superadmin','gerente'].includes(rol)) || rol === 'administrador' || rol === 'admin') return true;
  let raw = usuario.Permisos ?? '';
  if (Array.isArray(raw)) return raw.length > 0;
  if (raw && typeof raw === 'object') return Object.values(raw).some(v => v === true || v === 1 || v === '1');
  try { const parsed = JSON.parse(String(raw)); if (Array.isArray(parsed)) return parsed.length > 0; if (parsed && typeof parsed === 'object') return Object.values(parsed).some(v => v === true || v === 1 || v === '1'); } catch { /* Texto separado por comas. */ }
  const texto = normalizarPermiso(raw);
  if (!texto || ['sinpermisosasignados', 'ninguno', 'ningunpermiso'].includes(texto)) return false;
  return String(raw).split(/[,;|\n]/).some(x => normalizarPermiso(x).length > 0);
};


function CambiarContrasena({ sesion }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const enviar = async (e) => {
    e.preventDefault(); setError(''); setMensaje('');
    if (nueva.length < 6) return setError('La nueva contraseña debe tener al menos 6 caracteres.');
    if (nueva !== confirmar) return setError('La confirmación no coincide con la nueva contraseña.');
    setCargando(true);
    try {
      const response = await fetch('http://localhost:3000/api/auth/cambiar-contrasena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion?.token || ''}` },
        body: JSON.stringify({ contrasenaActual: actual, nuevaContrasena: nueva })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.mensaje || 'No se pudo cambiar la contraseña.');
      setMensaje(`${data.mensaje} ${data.emailEnviado ? 'Te enviamos una notificación por correo.' : 'No fue posible enviar el correo de notificación.'}`);
      setActual(''); setNueva(''); setConfirmar('');
    } catch (err) { setError(err.message || 'Error de conexión.'); }
    finally { setCargando(false); }
  };
  return <section className="lunaria-change-password">
    <h2>Seguridad de tu cuenta</h2>
    <p>Cambia tu contraseña verificando primero la actual.</p>
    <form onSubmit={enviar}>
      <label>Contraseña actual<input type="password" autoComplete="current-password" value={actual} onChange={e=>setActual(e.target.value)} required /></label>
      <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={6} value={nueva} onChange={e=>setNueva(e.target.value)} required /></label>
      <label>Confirmar nueva contraseña<input type="password" autoComplete="new-password" minLength={6} value={confirmar} onChange={e=>setConfirmar(e.target.value)} required /></label>
      {error && <p className="error" role="alert">{error}</p>}
      {mensaje && <p className="success" role="status">{mensaje}</p>}
      <button type="submit" disabled={cargando}>{cargando ? 'Actualizando…' : 'Actualizar contraseña'}</button>
    </form>
  </section>;
}


function GestionCuenta({ sesion, onCerrarSesion }) {
  const [contrasena, setContrasena] = useState('');
  const [accion, setAccion] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const ejecutar = async (tipo) => {
    setError(''); setMensaje('');
    if (!contrasena) return setError('Escribe tu contraseña para confirmar esta acción.');
    const texto = tipo === 'desactivar'
      ? '¿Deseas desactivar temporalmente tu cuenta? Podrás reactivarla iniciando sesión antes de 90 días.'
      : '¿Estás seguro de eliminar tu cuenta? Tus datos personales se anonimizarán y esta acción no se puede deshacer.';
    if (!window.confirm(texto)) return;
    setCargando(true);
    try {
      const response = await fetch(tipo === 'desactivar' ? 'http://localhost:3000/api/auth/desactivar-cuenta' : 'http://localhost:3000/api/auth/cuenta', {
        method: tipo === 'desactivar' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion?.token || ''}` },
        body: JSON.stringify({ contrasena })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.mensaje || 'No se pudo completar la operación.');
      if (tipo === 'eliminar') {
        window.alert(data.mensaje || 'Cuenta eliminada.');
        onCerrarSesion();
      } else {
        window.alert(data.mensaje || 'Cuenta desactivada.');
        onCerrarSesion();
      }
    } catch (e) { setError(e.message || 'Error de conexión.'); }
    finally { setCargando(false); }
  };
  return <section className="lunaria-account-management">
    <h2>Administrar mi cuenta</h2>
    <p>Puedes suspender tu cuenta temporalmente y volver a activarla iniciando sesión dentro de los siguientes 90 días. Si eliges eliminarla, tus datos personales se anonimizarán y el historial de reservas se conservará.</p>
    <label>Confirma tu contraseña<input type="password" autoComplete="current-password" value={contrasena} onChange={e=>setContrasena(e.target.value)} placeholder="Tu contraseña actual" /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="lunaria-account-danger-actions">
      <button type="button" disabled={cargando} onClick={()=>ejecutar('desactivar')}>{cargando ? 'Procesando…' : 'Desactivar temporalmente'}</button>
      <button type="button" disabled={cargando} onClick={()=>ejecutar('eliminar')}>Eliminar mi cuenta</button>
    </div>
    <small>Al cumplir 90 días desactivada, la cuenta se cerrará automáticamente y sus datos personales serán anonimizados.</small>
  </section>;
}

export default function App() {
  const [sesion, setSesion] = useState(leerSesion);
  const [pantalla, setPantalla] = useState('inicio');
  const [modoAcceso, setModoAcceso] = useState('login');

  useEffect(() => {
    const abrirAcceso = (event) => {
      setModoAcceso(event.detail?.modo || 'login');
      setPantalla('acceso');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('lunaria:acceso', abrirAcceso);
    return () => window.removeEventListener('lunaria:acceso', abrirAcceso);
  }, []);

  const entrar = (datos) => {
    localStorage.setItem('lunariaSesion', JSON.stringify(datos));
    if (datos.usuario?.Rol) localStorage.setItem('usuarioRol', datos.usuario.Rol);
    if (datos.usuario?.Nombre) localStorage.setItem('usuarioNombre', datos.usuario.Nombre);
    if (datos.token) localStorage.setItem('lunariaToken', datos.token);
    setSesion(datos);
    const reservaPendiente = Boolean(sessionStorage.getItem('lunariaReservaPendiente'));
    setPantalla(usuarioEsCliente(datos.usuario) ? (reservaPendiente ? 'inicio' : 'cuenta') : (tienePermisosAdmin(datos.usuario) ? 'admin' : 'inicio'));
  };

  const cerrarSesion = () => {
    localStorage.removeItem('lunariaSesion');
    localStorage.removeItem('lunariaToken');
    localStorage.removeItem('usuarioNombre');
    localStorage.removeItem('usuarioRol');
    setSesion(null);
    setPantalla('inicio');
    setModoAcceso('login');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const rolId = Number(sesion?.usuario?.idRolesFK);
  const puedeAdministrar = Boolean(sesion && !usuarioEsCliente(sesion.usuario) && tienePermisosAdmin(sesion.usuario));

  if (pantalla === 'acceso') return <AccesoHotel modo={modoAcceso} cambiarModo={setModoAcceso} volver={() => setPantalla('inicio')} alEntrar={entrar} />;
  if (pantalla === 'admin') {
    if (!sesion || !puedeAdministrar) return <AccesoHotel modo="login" cambiarModo={setModoAcceso} volver={() => setPantalla('inicio')} alEntrar={entrar} mensaje="Inicia sesión con una cuenta autorizada para el área administrativa." />;
    return <div className="lunaria-admin-shell"><GestionRoles sesion={sesion} onCerrarSesion={cerrarSesion} onVerPaginaPublica={() => setPantalla('inicio')} /></div>;
  }
  if (pantalla === 'cuenta') {
    if (!sesion || !usuarioEsCliente(sesion.usuario)) { setPantalla('inicio'); return null; }
    return <main className="lunaria-account"><header><img src="/img/Logo.jpg" alt="Hotel Lunaria"/><div><h1>Mi cuenta Lunaria</h1><p>Hola, {sesion.usuario.Nombre}. Ya iniciaste sesión.</p></div><button onClick={cerrarSesion}>Cerrar sesión</button><button onClick={() => setPantalla('inicio')}>Volver al hotel</button></header><section><h2>Tu próxima estadía comienza aquí</h2><p>Consulta la disponibilidad desde la página principal, elige una habitación y personaliza tu estadía con paquetes y servicios opcionales.</p><button onClick={() => setPantalla('inicio')}>Explorar habitaciones y servicios</button></section><CambiarContrasena sesion={sesion}/><GestionCuenta sesion={sesion} onCerrarSesion={cerrarSesion}/><section style={{padding:'24px',maxWidth:1000,margin:'0 auto'}}><GestionComentarios sesion={sesion} clienteOnly /></section></main>;
  }
  return <ClienteHotel sesion={sesion} onCerrarSesion={cerrarSesion} onReturnToPanel={() => setPantalla('admin')} onOpenAccount={() => setPantalla('cuenta')} />;
}
