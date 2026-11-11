import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const obtenerTokenSesion = () => {
  const tokenGuardado = localStorage.getItem('lunariaToken');
  if (tokenGuardado && tokenGuardado !== 'undefined' && tokenGuardado !== 'null') return tokenGuardado;
  try {
    const sesion = JSON.parse(localStorage.getItem('lunariaSesion') || 'null');
    return sesion?.token || sesion?.usuario?.token || '';
  } catch {
    return '';
  }
};

const authHeaders = () => ({ Authorization: `Bearer ${obtenerTokenSesion()}` });

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroInicial, setFiltroInicial] = useState('');

  const [modalAgregar, setModalAgregar] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState(null);
  const [alertaMsg, setAlertaMsg] = useState(null);

  const [rolUsuarioActual] = useState(localStorage.getItem('usuarioRol') || 'Gerente');
  const esSuperAdminActual = rolUsuarioActual === 'Gerente' || rolUsuarioActual === 'Administrador Principal';

  const [nuevoUsuario, setNuevoUsuario] = useState({
    Nombre: '',
    Email: '',
    Telefono: '',
    idRolesFK: '',
    contraseña: '',
    Estado: 1
  });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [resUsers, resRoles] = await Promise.all([
        fetch('http://localhost:3000/api/usuarios', { headers: authHeaders() }),
        fetch('http://localhost:3000/api/opciones-roles', { headers: authHeaders() })
      ]);

      if (!resUsers.ok) throw new Error(`Error ${resUsers.status} al obtener usuarios`);

      const dataUsers = await resUsers.json();

      if (Array.isArray(dataUsers)) {
        const usuariosNormalizados = dataUsers.map((u) => ({
          idUsuarios: u.idUsuarios || u.idusuarios || u.id || u.ID,
          Nombre: u.Nombre || u.nombre || u.NOMBRE || '',
          Email: u.Email || u.email || u.EMAIL || '',
          Telefono: u.Telefono || u.telefono || u.TELEFONO || '',
          Rol: u.Rol || u.rol || u.ROL || 'Sin Rol',
          idRolesFK: u.idRolesFK || u.idrolesfk || u.idRoles || '',
          Estado: u.Estado !== undefined ? u.Estado : (u.estado !== undefined ? u.estado : 1)
        }));
        setUsuarios(usuariosNormalizados);
      }

      if (resRoles.ok) {
        const dataRoles = await resRoles.json();
        setRoles(dataRoles);
      }
    } catch (err) {
      console.error('Error al cargar datos de usuarios:', err);
      setErrorCarga(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Verificar si un usuario es Gerente
  const esSuperAdmin = (usuario) => {
    if (!usuario) return false;
    const nombreRol = String(usuario.Rol || '').toLowerCase();
    const rolEnLista = roles.find(r => Number(r.id || r.idRoles) === Number(usuario.idRolesFK));
    const nombreRolLista = String(rolEnLista?.nombre || rolEnLista?.nomRol || '').toLowerCase();
    
    return nombreRol === 'gerente' || nombreRolLista === 'gerente';
  };

  const esAdminNormal = (usuario) => {
    if (!usuario) return false;
    const nombreRol = String(usuario.Rol || '').toLowerCase();
    return nombreRol === 'administrador' || nombreRol === 'admin';
  };

  // Roles seleccionables exclusivamente (Administrador, Recepcionista, Cliente)
  const rolesDisponibles = roles.filter(r => {
    const nombreRol = String(r.nombre || r.nomRol || '').toLowerCase();
    
    // Nadie puede asignar el rol Gerente
    if (nombreRol === 'gerente' || nombreRol === 'administrador principal') {
      return false;
    }

    // Un Admin normal no puede crear ni asignar el rol Administrador
    if (!esSuperAdminActual && (nombreRol === 'administrador' || nombreRol === 'admin')) {
      return false;
    }

    return true;
  });

  const solicitarEdicion = (usuario) => {
    if (!esSuperAdminActual && (esSuperAdmin(usuario) || esAdminNormal(usuario))) {
      setAlertaMsg('No tienes permisos suficientes para modificar este usuario.');
      return;
    }
    setUsuarioEditando({ ...usuario });
  };

  const solicitarEliminacion = (usuarioAEliminar) => {
    if (esSuperAdmin(usuarioAEliminar)) {
      setAlertaMsg('El Administrador Principal (Gerente) no puede ser eliminado.');
      return;
    }

    if (!esSuperAdminActual && esAdminNormal(usuarioAEliminar)) {
      setAlertaMsg('No tienes privilegios suficientes. Solo el Gerente puede eliminar Administradores.');
      return;
    }

    setConfirmarEliminarId(usuarioAEliminar.idUsuarios);
  };

  const handleGuardarNuevo = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(nuevoUsuario)
      });

      if (res.ok) {
        setModalAgregar(false);
        setNuevoUsuario({ Nombre: '', Email: '', Telefono: '', idRolesFK: '', contraseña: '', Estado: 1 });
        cargarDatos();
        setAlertaMsg('Usuario registrado con éxito.');
      } else {
        setAlertaMsg('Error al registrar el usuario.');
      }
    } catch (err) {
      console.error('Error al guardar:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:3000/api/usuarios/${usuarioEditando.idUsuarios}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(usuarioEditando)
      });

      if (res.ok) {
        setUsuarioEditando(null);
        cargarDatos();
        setAlertaMsg('Usuario actualizado correctamente.');
      } else {
        setAlertaMsg('Error al actualizar el usuario.');
      }
    } catch (err) {
      console.error('Error al editar:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const ejecutarEliminacion = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/usuarios/${confirmarEliminarId}`, { method: 'DELETE', headers: authHeaders() });

      if (res.ok) {
        setConfirmarEliminarId(null);
        cargarDatos();
        setAlertaMsg('Usuario eliminado correctamente.');
      } else {
        setAlertaMsg('Error al eliminar el usuario.');
      }
    } catch (err) {
      console.error('Error al eliminar:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const usuariosFiltrados = usuarios.filter((usuario) => {
    const nombre = String(usuario.Nombre || '').trim();
    const texto = filtroTexto.trim().toLocaleLowerCase('es');
    const coincideTexto = !texto || `${nombre} ${usuario.Email || ''} ${usuario.Telefono || ''} ${usuario.Rol || ''}`
      .toLocaleLowerCase('es').includes(texto);
    const inicial = filtroInicial.toLocaleLowerCase('es');
    const palabrasNombre = nombre.toLocaleLowerCase('es').split(/\\s+/).filter(Boolean);
    const coincideInicial = !inicial || palabrasNombre.some((palabra) => palabra.startsWith(inicial));
    return coincideTexto && coincideInicial;
  });

  return (
    <>
      <div className="roles-header-card">
        <h2>Usuarios</h2>
        <button className="btn-add-role" onClick={() => setModalAgregar(true)}>
          <Plus size={24} />
        </button>
      </div>

      <div className="admin-filter-bar">
        <input value={filtroTexto} onChange={e=>setFiltroTexto(e.target.value)} placeholder="Buscar por nombre, apellido o correo..."/>
        <select value={filtroInicial} onChange={e=>setFiltroInicial(e.target.value)}><option value="">Todas las iniciales</option>{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l=><option key={l} value={l}>{l}</option>)}</select>
      </div>
      <div className="roles-table-container">
        <div className="table-header" style={{ display: 'grid', gridTemplateColumns: 'minmax(55px,.45fr) minmax(165px,1.2fr) minmax(310px,2.2fr) minmax(175px,1.2fr) minmax(145px,1fr) minmax(100px,.7fr) minmax(115px,.8fr)', gap: '22px', minWidth: '1250px', padding: '12px 15px', fontWeight: 'bold' }}>
          <span>ID</span>
          <span>Nombre</span>
          <span>Email</span>
          <span>Teléfono</span>
          <span>Rol</span>
          <span>Estado</span>
          <span>Acciones</span>
        </div>

        {cargando ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#555' }}>
            Cargando usuarios desde la base de datos...
          </div>
        ) : errorCarga ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#e74c3c' }}>
            ⚠️ {errorCarga}.
          </div>
        ) : usuariosFiltrados.length > 0 ? (
          usuariosFiltrados.map((u) => {
            const puedeGestionarEsteUsuario = esSuperAdminActual || (!esSuperAdmin(u) && !esAdminNormal(u));

            return (
              <div 
                className="role-row" 
                key={u.idUsuarios} 
                style={{ display: 'grid', gridTemplateColumns: 'minmax(55px,.45fr) minmax(165px,1.2fr) minmax(310px,2.2fr) minmax(175px,1.2fr) minmax(145px,1fr) minmax(100px,.7fr) minmax(115px,.8fr)', gap: '22px', minWidth: '1250px', alignItems: 'center', padding: '12px 15px' }}
              >
                <span>{u.idUsuarios}</span>
                <span><strong>{u.Nombre}</strong></span>
                <span title={u.Email} style={{minWidth:0,maxWidth:'100%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingRight:'10px'}}>{u.Email}</span>
                <span style={{minWidth:0,whiteSpace:'nowrap'}}>{u.Telefono}</span>
                <span>
                  <span style={{ 
                    fontWeight: esSuperAdmin(u) ? 'bold' : 'normal',
                    color: esSuperAdmin(u) ? '#8e44ad' : 'inherit'
                  }}>
                    {u.Rol}
                  </span>
                </span>
                <span>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    backgroundColor: Number(u.Estado) === 1 ? '#d4edda' : '#f8d7da',
                    color: Number(u.Estado) === 1 ? '#155724' : '#721c24'
                  }}>
                    {Number(u.Estado) === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                </span>
                <div className="row-actions" style={{ display: 'flex', gap: '10px' }}>
                  <Pencil 
                    className="action-icon" 
                    size={18} 
                    style={{ 
                      cursor: puedeGestionarEsteUsuario ? 'pointer' : 'not-allowed', 
                      opacity: puedeGestionarEsteUsuario ? 1 : 0.3 
                    }} 
                    onClick={() => solicitarEdicion(u)} 
                  />
                  <Trash2 
                    className="action-icon" 
                    size={18} 
                    style={{ 
                      cursor: puedeGestionarEsteUsuario ? 'pointer' : 'not-allowed', 
                      opacity: puedeGestionarEsteUsuario ? 1 : 0.3 
                    }} 
                    onClick={() => solicitarEliminacion(u)} 
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: '30px', textAlign: 'center', color: '#777' }}>
            No hay usuarios que coincidan con los filtros.
          </div>
        )}
      </div>

      {/* MODAL CREAR */}
      {modalAgregar && (
        createPortal(<div className="modal-overlay">
          <form className="modal-content" onSubmit={handleGuardarNuevo}>
            <h3>Agregar Nuevo Usuario</h3>
            <div className="modal-field">
              <label>Nombre Completo</label>
              <input 
                type="text" 
                required 
                value={nuevoUsuario.Nombre}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, Nombre: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Correo Electrónico</label>
              <input 
                type="email" 
                required 
                value={nuevoUsuario.Email}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, Email: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Contraseña</label>
              <input 
                type="password" 
                required 
                value={nuevoUsuario.contraseña}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, contraseña: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Teléfono</label>
              <input 
                type="text" 
                required 
                value={nuevoUsuario.Telefono}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, Telefono: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Rol</label>
              <select 
                required
                value={nuevoUsuario.idRolesFK}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, idRolesFK: Number(e.target.value) })}
              >
                <option value="">Seleccione un Rol</option>
                {rolesDisponibles.map((r) => (
                  <option key={r.id || r.idRoles} value={r.id || r.idRoles}>
                    {r.nombre || r.nomRol}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label>Estado</label>
              <select 
                value={nuevoUsuario.Estado}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, Estado: Number(e.target.value) })}
              >
                <option value={1}>Activo</option>
                <option value={0}>Inactivo</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancelar" onClick={() => setModalAgregar(false)}>Cancelar</button>
              <button type="submit" className="btn-guardar">Guardar</button>
            </div>
          </form>
        </div>, document.body)
      )}

      {/* MODAL EDITAR */}
      {usuarioEditando && (
        createPortal(<div className="modal-overlay">
          <form className="modal-content" onSubmit={handleGuardarEdicion}>
            <h3>Editar Usuario</h3>
            <div className="modal-field">
              <label>Nombre Completo</label>
              <input 
                type="text" 
                required 
                value={usuarioEditando.Nombre}
                onChange={(e) => setUsuarioEditando({ ...usuarioEditando, Nombre: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Correo Electrónico</label>
              <input 
                type="email" 
                required 
                value={usuarioEditando.Email}
                onChange={(e) => setUsuarioEditando({ ...usuarioEditando, Email: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Teléfono</label>
              <input 
                type="text" 
                required 
                value={usuarioEditando.Telefono}
                onChange={(e) => setUsuarioEditando({ ...usuarioEditando, Telefono: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Rol</label>
              <select 
                required
                disabled={esSuperAdmin(usuarioEditando)}
                value={usuarioEditando.idRolesFK}
                onChange={(e) => setUsuarioEditando({ ...usuarioEditando, idRolesFK: Number(e.target.value) })}
              >
                {esSuperAdmin(usuarioEditando) ? (
                  <option value={usuarioEditando.idRolesFK}>{usuarioEditando.Rol}</option>
                ) : (
                  rolesDisponibles.map((r) => (
                    <option key={r.id || r.idRoles} value={r.id || r.idRoles}>
                      {r.nombre || r.nomRol}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="modal-field">
              <label>Estado</label>
              <select 
                disabled={esSuperAdmin(usuarioEditando)}
                value={usuarioEditando.Estado}
                onChange={(e) => setUsuarioEditando({ ...usuarioEditando, Estado: Number(e.target.value) })}
              >
                <option value={1}>Activo</option>
                <option value={0}>Inactivo</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancelar" onClick={() => setUsuarioEditando(null)}>Cancelar</button>
              <button type="submit" className="btn-guardar">Actualizar</button>
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
              <button className="btn-guardar" onClick={() => setAlertaMsg(null)}>Aceptar</button>
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
              ¿Deseas eliminar este usuario permanentemente?
            </p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn-cancelar" onClick={() => setConfirmarEliminarId(null)}>Cancelar</button>
              <button className="btn-guardar" style={{ backgroundColor: '#e74c3c' }} onClick={ejecutarEliminacion}>Eliminar</button>
            </div>
          </div>
        </div>, document.body)
      )}
    </>
  );
}