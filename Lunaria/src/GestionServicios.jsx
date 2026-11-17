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

export default function GestionServicios() {
  const [filtroModulo, setFiltroModulo] = useState('');
  const [servicios, setServicios] = useState([]);
  const [modalAgregar, setModalAgregar] = useState(false);
  const [servicioEditando, setServicioEditando] = useState(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState(null);
  const [alertaMsg, setAlertaMsg] = useState(null);

  const [nuevoServicio, setNuevoServicio] = useState({
    nombre: '',
    precio: '',
    estado: 1,
    imagen: ''
  });

  const cargarServicios = useCallback(async () => {
    try {
      const res = await fetch('https://lunariasuites.onrender.com/api/servicios', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setServicios(data);
      }
    } catch (err) {
      console.error('Error al cargar servicios:', err);
    }
  }, []);

  useEffect(() => {
    cargarServicios();
  }, [cargarServicios]);

  const handleGuardarNuevo = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('https://lunariasuites.onrender.com/api/servicios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          nombre: nuevoServicio.nombre,
          precio: parseFloat(nuevoServicio.precio),
          estado: Number(nuevoServicio.estado),
          imagen: nuevoServicio.imagen
        })
      });

      if (res.ok) {
        setModalAgregar(false);
        cargarServicios();
        setAlertaMsg('Servicio creado correctamente.');
        setNuevoServicio({ nombre: '', precio: '', estado: 1, imagen: '' });
      } else {
        setAlertaMsg('No se pudo guardar el servicio.');
      }
    } catch (err) {
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`https://lunariasuites.onrender.com/api/servicios/${servicioEditando.idServicios}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          nombre: servicioEditando.nombre,
          precio: parseFloat(servicioEditando.precio),
          estado: Number(servicioEditando.estado),
          imagen: servicioEditando.imagen || ''
        })
      });

      if (res.ok) {
        setServicioEditando(null);
        cargarServicios();
        setAlertaMsg('Servicio actualizado con éxito.');
      } else {
        setAlertaMsg('No se pudo actualizar el servicio.');
      }
    } catch (err) {
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const ejecutarEliminacion = async () => {
    try {
      const res = await fetch(`https://lunariasuites.onrender.com/api/servicios/${confirmarEliminarId}`, { method: 'DELETE', headers: authHeaders() });

      if (res.ok) {
        setConfirmarEliminarId(null);
        cargarServicios();
        setAlertaMsg('Servicio eliminado correctamente.');
      } else {
        setAlertaMsg('No se pudo eliminar el servicio.');
      }
    } catch (err) {
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const serviciosFiltrados = servicios.filter(item => [item.nombre, item.descripcion].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(filtroModulo.trim().toLocaleLowerCase('es')));

  return (
    <>
      <div className="roles-header-card">
        <h2>Gestión de Servicios</h2>
        <button className="btn-add-role" onClick={() => setModalAgregar(true)}>
          <Plus size={24} />
        </button>
      </div>

      <div className="admin-filter-bar"><input value={filtroModulo} onChange={e=>setFiltroModulo(e.target.value)} placeholder="Filtrar servicios..."/></div>
      <div className="roles-table-container servicios-table">
        <div className="table-header">
          <span>ID</span>
          <span>Imagen</span>
          <span>Nombre del Servicio</span>
          <span>Precio</span>
          <span>Estado</span>
          <span>Acciones</span>
        </div>

        {servicios.length > 0 ? (
          serviciosFiltrados.map((serv) => (
            <div className="role-row" key={serv.idServicios}>
              <span>{serv.idServicios}</span>
              <span className="servicio-admin-imagen">{serv.imagen ? <img src={serv.imagen} alt={serv.nombre} onError={e => { e.currentTarget.style.display = 'none'; }} /> : <span className="servicio-sin-imagen">Sin imagen</span>}</span>
              <span><strong>{serv.nombre}</strong></span>
              <span>${Number(serv.precio).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
              <span>
                <span className={`status-badge ${Number(serv.estado) === 1 ? 'active' : 'inactive'}`}>
                  {Number(serv.estado) === 1 ? 'Activo' : 'Inactivo'}
                </span>
              </span>
              <div className="row-actions">
                <Pencil 
                  className="action-icon" 
                  size={18} 
                  onClick={() => setServicioEditando({ ...serv })} 
                />
                <Trash2 
                  className="action-icon" 
                  size={18} 
                  onClick={() => setConfirmarEliminarId(serv.idServicios)} 
                />
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#777' }}>
            No hay servicios registrados.
          </div>
        )}
      </div>

      {/* MODAL AGREGAR */}
      {modalAgregar && (
        createPortal(<div className="modal-overlay">
          <form className="modal-content" onSubmit={handleGuardarNuevo}>
            <h3>Agregar Nuevo Servicio</h3>
            <div className="modal-field">
              <label>Nombre del Servicio</label>
              <input 
                type="text" 
                placeholder="Ej. Spa, Desayuno Buffet, Lavandería" 
                value={nuevoServicio.nombre} 
                onChange={(e) => setNuevoServicio({ ...nuevoServicio, nombre: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-field">
              <label>Precio ($)</label>
              <input 
                type="number" 
                step="0.01" 
                placeholder="Ej. 50000" 
                value={nuevoServicio.precio} 
                onChange={(e) => setNuevoServicio({ ...nuevoServicio, precio: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-field">
              <label>Ruta de imagen (dentro de public)</label>
              <select value={nuevoServicio.imagen} onChange={(e) => setNuevoServicio({ ...nuevoServicio, imagen: e.target.value })}>
                <option value="">Sin imagen</option><option value="/servicios/Spa.jpg">Spa</option><option value="/servicios/desayuno.jpg">Desayuno buffet</option><option value="/servicios/Masaje.jpg">Masaje</option><option value="/servicios/Transporte.jpg">Transporte</option><option value="/servicios/lavanderia.jpg">Lavandería</option><option value="/servicios/Bicicletas.jpg">Bicicletas</option>
              </select>
              {nuevoServicio.imagen && <img className="servicio-preview" src={nuevoServicio.imagen} alt="Vista previa" />}
            </div>
            <div className="modal-field">
              <label>Estado</label>
              <select 
                value={nuevoServicio.estado} 
                onChange={(e) => setNuevoServicio({ ...nuevoServicio, estado: e.target.value })}
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
      {servicioEditando && (
        createPortal(<div className="modal-overlay">
          <form className="modal-content" onSubmit={handleGuardarEdicion}>
            <h3>Editar Servicio #{servicioEditando.idServicios}</h3>
            <div className="modal-field">
              <label>Nombre del Servicio</label>
              <input 
                type="text" 
                value={servicioEditando.nombre} 
                onChange={(e) => setServicioEditando({ ...servicioEditando, nombre: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-field">
              <label>Precio ($)</label>
              <input 
                type="number" 
                step="0.01" 
                value={servicioEditando.precio} 
                onChange={(e) => setServicioEditando({ ...servicioEditando, precio: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-field">
              <label>Ruta de imagen (dentro de public)</label>
              <select value={servicioEditando.imagen || ''} onChange={(e) => setServicioEditando({ ...servicioEditando, imagen: e.target.value })}>
                <option value="">Sin imagen</option><option value="/servicios/Spa.jpg">Spa</option><option value="/servicios/desayuno.jpg">Desayuno buffet</option><option value="/servicios/Masaje.jpg">Masaje</option><option value="/servicios/Transporte.jpg">Transporte</option><option value="/servicios/lavanderia.jpg">Lavandería</option><option value="/servicios/Bicicletas.jpg">Bicicletas</option>
              </select>
              {servicioEditando.imagen && <img className="servicio-preview" src={servicioEditando.imagen} alt="Vista previa" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            </div>
            <div className="modal-field">
              <label>Estado</label>
              <select 
                value={servicioEditando.estado} 
                onChange={(e) => setServicioEditando({ ...servicioEditando, estado: e.target.value })}
              >
                <option value={1}>Activo</option>
                <option value={0}>Inactivo</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancelar" onClick={() => setServicioEditando(null)}>Cancelar</button>
              <button type="submit" className="btn-guardar">Actualizar</button>
            </div>
          </form>
        </div>, document.body)
      )}

      {/* MODAL ALERTA */}
      {alertaMsg && (
        createPortal(<div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center', width: '350px' }}>
            <h3>Notificación</h3>
            <p style={{ margin: '15px 0' }}>{alertaMsg}</p>
            <button className="btn-guardar" onClick={() => setAlertaMsg(null)}>Aceptar</button>
          </div>
        </div>, document.body)
      )}

      {/* MODAL ELIMINAR */}
      {confirmarEliminarId && (
        createPortal(<div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center', width: '350px' }}>
            <h3>Confirmar Eliminación</h3>
            <p style={{ margin: '15px 0' }}>¿Deseas eliminar este servicio?</p>
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