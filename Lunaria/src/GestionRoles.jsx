import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './GestionRoles.css';
import StatCards from './StatCards';
import GestionUsuarios from './GestionUsuarios';
import GestionHabitaciones from './GestionHabitaciones';
import GestionServicios from './GestionServicios';
import GestionPaquetes from './GestionPaquetes';
import GestionClientes from './GestionClientes';
import GestionReservas from './GestionReservas';
import GestionHuespedes from './GestionHuespedes';
import GestionComentarios from './GestionComentarios';
import { 
  IdCard, Users, BedDouble, ConciergeBell, Tag, UserCheck, 
  ClipboardList, Luggage, User, Plus, Pencil, Trash2, MessageCircle 
} from 'lucide-react';

const menuItems = [
  { id: 'roles', label: 'Roles', icon: IdCard },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'habitaciones', label: 'Habitaciones', icon: BedDouble },
  { id: 'servicios', label: 'Servicios', icon: ConciergeBell },
  { id: 'paquetes', label: 'Paquetes', icon: Tag },
  { id: 'clientes', label: 'Clientes', icon: UserCheck },
  { id: 'reservas', label: 'Reservas', icon: ClipboardList },
  { id: 'huespedes', label: 'Huéspedes', icon: Luggage },
  { id: 'comentarios', label: 'Comentarios', icon: MessageCircle },
];

const normalizarPermiso = (valor = '') => String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function esSuperAdmin(usuario = {}) {
  return Number(usuario.idRolesFK) === 1 || ['superadmin', 'gerente'].includes(normalizarPermiso(usuario.Rol));
}
function esAdministrador(usuario = {}) {
  const rol = normalizarPermiso(usuario.Rol);
  return rol === 'administrador' || rol === 'admin';
}
function esSoporte(usuario = {}) {
  return ['personaldeapoyo','soportetecnico','soporte'].includes(normalizarPermiso(usuario.Rol));
}
function permisosDeSesion(sesion) {
  const usuario = sesion?.usuario || {};
  if (esSuperAdmin(usuario)) return new Set(menuItems.map(item => item.id));
  // El Administrador puede gestionar todos los módulos operativos, pero no los roles.
  if (esAdministrador(usuario)) return new Set(menuItems.filter(item => item.id !== 'roles').map(item => item.id));
  if (esSoporte(usuario)) return new Set(['comentarios']);
  let raw = usuario.Permisos ?? usuario.permisos ?? '';
  if (Array.isArray(raw)) return new Set(raw.map(normalizarPermiso));
  if (raw && typeof raw === 'object') return new Set(Object.entries(raw).filter(([,v]) => v === true || v === 1 || v === '1').map(([k]) => normalizarPermiso(k)));
  const texto = String(raw).trim();
  if (!texto) return new Set();
  try {
    const parsed = JSON.parse(texto);
    if (Array.isArray(parsed)) return new Set(parsed.map(normalizarPermiso));
    if (parsed && typeof parsed === 'object') return new Set(Object.entries(parsed).filter(([,v]) => v === true || v === 1 || v === '1').map(([k]) => normalizarPermiso(k)));
  } catch { /* Los permisos también pueden venir como texto separado por comas o punto y coma. */ }
  return new Set(texto.split(/[,;|\n]/).map(normalizarPermiso).filter(Boolean));
}
function tienePermisoModulo(sesion, modulo) {
  const permisos = permisosDeSesion(sesion);
  if (esSuperAdmin(sesion?.usuario)) return true;
  if (esAdministrador(sesion?.usuario)) return modulo !== 'roles';
  if (esSoporte(sesion?.usuario)) return modulo === 'comentarios';
  const alias = {
    roles: ['roles', 'gestionroles', 'gestionderoles', 'administracionderoles'], usuarios: ['usuarios', 'gestionusuarios', 'gestiondeusuarios'],
    habitaciones: ['habitaciones', 'gestionhabitaciones', 'gestiondehabitaciones'], servicios: ['servicios', 'gestionservicios', 'gestiondeservicios'],
    paquetes: ['paquetes', 'gestionpaquetes', 'gestiondepaquetes'], clientes: ['clientes', 'gestionclientes', 'gestiondeclientes'],
    reservas: ['reservas', 'gestionreservas', 'gestiondereservas'], huespedes: ['huespedes', 'huesped', 'gestionhuespedes', 'gestiondehuespedes']
  };
  return (alias[modulo] || [modulo]).some(a => permisos.has(normalizarPermiso(a)));
}

export default function GestionRoles({ sesion, onCerrarSesion, onVerPaginaPublica }) {
  const [seccionActiva, setSeccionActiva] = useState(esSuperAdmin(sesion?.usuario) ? 'roles' : 'usuarios');
  const menuPermitido = menuItems.filter(item => tienePermisoModulo(sesion, item.id));
  useEffect(() => {
    if (!menuPermitido.some(item => item.id === seccionActiva) && menuPermitido.length) setSeccionActiva(menuPermitido[0].id);
  }, [seccionActiva, menuPermitido.map(item => item.id).join('|')]);

  const [roles, setRoles] = useState([]);
  const [rolEditando, setRolEditando] = useState(null);
  const [claveAdmin, setClaveAdmin] = useState('');
  const [filtroTarjeta, setFiltroTarjeta] = useState('todos');

  // La identidad del encabezado viene de la sesión autenticada, nunca de un Gerente fijo.
  const usuarioLogueado = sesion?.usuario?.Nombre || 'Usuario';
  const rolUsuarioLogueado = sesion?.usuario?.Rol || 'Sin rol';
  const [menuPerfilAbierto, setMenuPerfilAbierto] = useState(false);

  // Modales y Alertas
  const [modalAgregar, setModalAgregar] = useState(false);
  const [nuevoRol, setNuevoRol] = useState({ nombre: '', permisos: '', estado: 'Activo' });
  const [claveAgregarAdmin, setClaveAgregarAdmin] = useState('');
  const [alertaMsg, setAlertaMsg] = useState(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState(null);

  const obtenerRoles = useCallback(async () => {
    try {
      const res = await fetch('https://lunariasuites.onrender.com/api/roles', { headers: { Authorization: `Bearer ${sesion?.token || localStorage.getItem('lunariaToken') || ''}` } });
      if (!res.ok) throw new Error('Error en la respuesta del servidor');
      const data = await res.json();
      setRoles(data);
    } catch (err) {
      console.error('Error al cargar roles:', err);
    }
  }, [sesion?.token]);

  useEffect(() => {
    obtenerRoles();
  }, [obtenerRoles]);

  const rolesFiltrados = roles.filter((rol) => {
    if (filtroTarjeta === 'activos') return rol.estado === 'Activo';
    if (filtroTarjeta === 'inactivos') return rol.estado === 'Inactivo';
    if (filtroTarjeta === 'criticos') return rol.permisos && rol.permisos.trim() !== '';
    return true;
  });

  const handleGuardarNuevoRol = async (e) => {
    e.preventDefault();
    if (claveAgregarAdmin !== '12345') {
      setAlertaMsg('Clave de seguridad de Administrador incorrecta.');
      return;
    }

    try {
      const res = await fetch('https://lunariasuites.onrender.com/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion?.token || localStorage.getItem('lunariaToken') || ''}` },
        body: JSON.stringify(nuevoRol)
      });

      if (res.ok) {
        setModalAgregar(false);
        obtenerRoles();
        setAlertaMsg(`Rol "${nuevoRol.nombre}" guardado en la base de datos.`);
      } else {
        setAlertaMsg('No se pudo guardar el rol en la base de datos.');
      }
    } catch (err) {
      console.error('Error al agregar:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    
    // Protección extra: Evitar edición si es Gerente
    if (rolEditando.nombre === 'Gerente' || rolEditando.id === 1) {
      setAlertaMsg('El rol Gerente no puede ser modificado.');
      return;
    }

    try {
      const res = await fetch(`https://lunariasuites.onrender.com/api/roles/${rolEditando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion?.token || localStorage.getItem('lunariaToken') || ''}` },
        body: JSON.stringify(rolEditando)
      });

      if (res.ok) {
        setRolEditando(null);
        obtenerRoles();
        setAlertaMsg('Rol actualizado con éxito.');
      } else {
        setAlertaMsg('No se pudo actualizar el rol.');
      }
    } catch (err) {
      console.error('Error al actualizar:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const ejecutarEliminacion = async () => {
    try {
      const res = await fetch(`https://lunariasuites.onrender.com/api/roles/${confirmarEliminarId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sesion?.token || localStorage.getItem('lunariaToken') || ''}` }
      });

      if (res.ok) {
        setConfirmarEliminarId(null);
        obtenerRoles();
        setAlertaMsg('Rol eliminado correctamente.');
      } else {
        setAlertaMsg('No se pudo eliminar el rol.');
      }
    } catch (err) {
      console.error('Error al eliminar:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const handleCerrarSesion = () => {
    setMenuPerfilAbierto(false);
    if (typeof onCerrarSesion === 'function') onCerrarSesion();
  };

  const itemActivo = menuPermitido.find((m) => m.id === seccionActiva) || menuPermitido[0];

  const renderContenidoSeccion = () => {
    if (!menuPermitido.length) return <div className="roles-header-card"><h2>Sin módulos autorizados</h2><p>Solicita al administrador que asigne permisos a tu rol.</p></div>;
    const seccionPermitida = menuPermitido.some((m) => m.id === seccionActiva) ? seccionActiva : menuPermitido[0]?.id;
    switch (seccionPermitida) {
      case 'roles':
        return (
          <>
            <div className="roles-header-card">
              <h2>Roles</h2>
              <button 
                className="btn-add-role" 
                onClick={() => { 
                  setNuevoRol({ nombre: '', permisos: '', estado: 'Activo' }); 
                  setClaveAgregarAdmin(''); 
                  setModalAgregar(true); 
                }}
              >
                <Plus size={24} />
              </button>
            </div>

            <StatCards 
              roles={roles} 
              filtroActivo={filtroTarjeta} 
              onSelectFiltro={setFiltroTarjeta} 
            />

            <div className="roles-table-container">
              <div className="table-header">
                <span>ID</span>
                <span>Nombre Rol</span>
                <span>Permisos</span>
                <span>Estado</span>
                <span></span>
              </div>

              {rolesFiltrados.length > 0 ? (
                rolesFiltrados.map((rol) => (
                  <div className="role-row" key={rol.id}>
                    <span>{rol.id}</span>
                    <span><strong>{rol.nombre}</strong></span>
                    <span>{rol.permisos || 'Sin permisos asignados'}</span>
                    <span>{rol.estado}</span>
                    <div className="row-actions">
                      <Pencil 
                        className="action-icon" 
                        size={18} 
                        onClick={() => { setRolEditando({ ...rol }); setClaveAdmin(''); }} 
                      />
                      <Trash2 
                        className="action-icon" 
                        size={18} 
                        onClick={() => {
                          if (rol.nombre === 'Gerente' || rol.id === 1) {
                            setAlertaMsg('El rol Gerente está protegido y no se puede eliminar.');
                          } else {
                            setConfirmarEliminarId(rol.id);
                          }
                        }} 
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#777' }}>
                  No hay roles registrados en la base de datos.
                </div>
              )}
            </div>
          </>
        );
      case 'usuarios':
        return <GestionUsuarios />;
      case 'habitaciones':
        return <GestionHabitaciones />;
      case 'servicios':
        return <GestionServicios />;
      case 'paquetes':
        return <GestionPaquetes />;
      case 'clientes':
        return <GestionClientes />;
      case 'reservas':
        return <GestionReservas />;
      case 'huespedes':
        return <GestionHuespedes />;
      case 'comentarios':
        return <GestionComentarios sesion={sesion} />;
      default:
        return (
          <div className="roles-table-container" style={{ textAlign: 'center', padding: '50px 20px' }}>
            <h2 style={{ marginBottom: '10px', color: '#333' }}>
              Módulo de {itemActivo ? itemActivo.label : ''}
            </h2>
            <p style={{ color: '#666', fontSize: '1rem' }}>
              Módulo en desarrollo para {itemActivo ? itemActivo.label.toLowerCase() : ''}.
            </p>
          </div>
        );
    }
  };

  const esRolSuperAdmin = Boolean(rolEditando && (rolEditando.nombre === 'Gerente' || rolEditando.id === 1));

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/img/Logo.jpg" alt="Logo Lunaria" className="logo-img" />
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {menuPermitido.map((item) => {
            const IconComponent = item.icon;
            const isSelected = seccionActiva === item.id;
            return (
              <div 
                key={item.id} 
                className={`nav-item ${isSelected ? 'active' : ''}`}
                onClick={() => setSeccionActiva(item.id)}
                style={{ cursor: 'pointer' }}
              >
                <IconComponent className="nav-icon" size={20} /> 
                {item.label}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar" style={{ position: 'relative', zIndex: 1000 }}>
          <h1>Gestión de {itemActivo ? itemActivo.label : ''}</h1>
          
          <div className="topbar-actions" style={{ position: 'relative' }}>
            <div 
              className="user-profile-btn"
              onClick={() => setMenuPerfilAbierto(!menuPerfilAbierto)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: '600', color: '#333', display: 'block' }}>
                  {usuarioLogueado}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#8e44ad', fontWeight: 'bold' }}>
                  {rolUsuarioLogueado}
                </span>
              </div>
              <div className="user-avatar" style={{ backgroundColor: '#8e44ad' }}>
                <User size={22} color="#fff" />
              </div>
            </div>

            {menuPerfilAbierto && (
              <div className="perfil-dropdown" style={{
                position: 'absolute',
                top: '110%',
                right: 0,
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                padding: '10px 0',
                minWidth: '170px',
                zIndex: 9999
              }}>
                <div 
                  style={{ padding: '10px 18px', cursor: 'pointer', color: '#333', fontSize: '0.95rem' }}
                  onClick={() => { setAlertaMsg(`Perfil activo: ${usuarioLogueado} (${rolUsuarioLogueado})`); setMenuPerfilAbierto(false); }}
                >
                  Mi Perfil
                </div>
                <div
                  style={{ padding: '10px 18px', cursor: 'pointer', color: '#344d40', fontSize: '0.95rem' }}
                  onClick={() => { setMenuPerfilAbierto(false); if (typeof onVerPaginaPublica === 'function') onVerPaginaPublica(); }}
                >
                  Ver página pública
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '4px 0' }} />
                <div 
                  style={{ padding: '10px 18px', cursor: 'pointer', color: '#e74c3c', fontSize: '0.95rem', fontWeight: 'bold' }}
                  onClick={handleCerrarSesion}
                >
                  Cerrar Sesión
                </div>
              </div>
            )}
          </div>
        </header>

        {renderContenidoSeccion()}
      </main>

      {/* MODAL AGREGAR ROL */}
      {modalAgregar && (
        createPortal(<div className="modal-overlay">
          <form className="modal-content" onSubmit={handleGuardarNuevoRol}>
            <h3>Agregar Nuevo Rol</h3>
            <div className="modal-field">
              <label>Nombre del Rol</label>
              <input 
                type="text" 
                placeholder="Ej. Recepcionista"
                value={nuevoRol.nombre} 
                onChange={(e) => setNuevoRol({ ...nuevoRol, nombre: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-field">
              <label>Permisos</label>
              <input 
                type="text" 
                placeholder="Ej. Check-in y cobro de reservas"
                value={nuevoRol.permisos} 
                onChange={(e) => setNuevoRol({ ...nuevoRol, permisos: e.target.value })} 
              />
            </div>
            <div className="modal-field">
              <label>Estado</label>
              <select 
                value={nuevoRol.estado} 
                onChange={(e) => setNuevoRol({ ...nuevoRol, estado: e.target.value })}
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
            <div className="modal-field" style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '8px' }}>
              <label style={{ color: '#856404' }}>🔒 Clave de Autorización Administrador</label>
              <input 
                type="password" 
                placeholder="Ingrese la clave requerida" 
                value={claveAgregarAdmin} 
                onChange={(e) => setClaveAgregarAdmin(e.target.value)} 
                required 
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancelar" onClick={() => setModalAgregar(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn-guardar">Agregar Rol</button>
            </div>
          </form>
        </div>, document.body)
      )}

      {/* MODAL EDITAR ROL */}
      {rolEditando && (
        createPortal(<div className="modal-overlay">
          <form className="modal-content" onSubmit={handleGuardarEdicion}>
            <h3>Editar Rol ({rolEditando.nombre})</h3>
            
            <div className="modal-field">
              <label>Nombre del Rol</label>
              <input 
                type="text" 
                value={rolEditando.nombre} 
                onChange={(e) => setRolEditando({ ...rolEditando, nombre: e.target.value })} 
                disabled={esRolSuperAdmin}
                style={{ 
                  backgroundColor: esRolSuperAdmin ? '#f0f0f0' : '#fff',
                  cursor: esRolSuperAdmin ? 'not-allowed' : 'text' 
                }}
                required 
              />
            </div>

            <div className="modal-field">
              <label>Permisos</label>
              <input 
                type="text" 
                value={rolEditando.permisos || ''} 
                onChange={(e) => setRolEditando({ ...rolEditando, permisos: e.target.value })} 
                disabled={esRolSuperAdmin}
                style={{ 
                  backgroundColor: esRolSuperAdmin ? '#f0f0f0' : '#fff',
                  cursor: esRolSuperAdmin ? 'not-allowed' : 'text' 
                }}
              />
            </div>

            <div className="modal-field">
              <label>Estado</label>
              <select 
                value={rolEditando.estado} 
                onChange={(e) => setRolEditando({ ...rolEditando, estado: e.target.value })}
                disabled={esRolSuperAdmin}
                style={{ 
                  backgroundColor: esRolSuperAdmin ? '#f0f0f0' : '#fff',
                  cursor: esRolSuperAdmin ? 'not-allowed' : 'pointer' 
                }}
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>

            {esRolSuperAdmin && (
              <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '10px 12px', borderRadius: '8px', fontSize: '0.88rem', margin: '10px 0' }}>
                🔒 El rol <strong>Gerente</strong> está protegido por el sistema y sus datos no pueden modificarse.
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-cancelar" onClick={() => setRolEditando(null)}>
                {esRolSuperAdmin ? 'Cerrar' : 'Cancelar'}
              </button>
              {!esRolSuperAdmin && (
                <button type="submit" className="btn-guardar">
                  Guardar Cambios
                </button>
              )}
            </div>
          </form>
        </div>, document.body)
      )}

      {/* MODAL ALERTA */}
      {alertaMsg && (
        createPortal(<div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center', width: '350px' }}>
            <h3>Mensaje del Sistema</h3>
            <p style={{ margin: '15px 0', fontSize: '1rem', color: '#333' }}>{alertaMsg}</p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn-guardar" onClick={() => setAlertaMsg(null)}>
                Aceptar
              </button>
            </div>
          </div>
        </div>, document.body)
      )}

      {/* MODAL ELIMINAR */}
      {confirmarEliminarId && (
        createPortal(<div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center', width: '350px' }}>
            <h3>Confirmar Acción</h3>
            <p style={{ margin: '15px 0', fontSize: '1rem', color: '#333' }}>
              ¿Estás seguro de que deseas eliminar este rol de la base de datos?
            </p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn-cancelar" onClick={() => setConfirmarEliminarId(null)}>
                Cancelar
              </button>
              <button className="btn-guardar" style={{ backgroundColor: '#e74c3c', color: '#fff' }} onClick={ejecutarEliminacion}>
                Eliminar
              </button>
            </div>
          </div>
        </div>, document.body)
      )}
    </div>
  );
}