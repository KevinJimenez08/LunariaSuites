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

export default function GestionClientes() {
  const [filtroModulo, setFiltroModulo] = useState('');
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  const [modalAgregar, setModalAgregar] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState(null);
  const [alertaMsg, setAlertaMsg] = useState(null);

  const [nuevoCliente, setNuevoCliente] = useState({
    Nombre: '',
    Email: '',
    Telefono: '',
    Estado: 1
  });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await fetch('https://lunariasuites.onrender.com/api/clientes', { headers: authHeaders() });

      if (!res.ok) throw new Error(`Error ${res.status} al obtener clientes`);

      const data = await res.json();

      if (Array.isArray(data)) {
        const clientesNormalizados = data.map((c) => ({
          idClientes: c.idClientes || c.idclientes || c.id || c.ID,
          Nombre: c.Nombre || c.nombre || c.NOMBRE || '',
          Email: c.Email || c.email || c.EMAIL || '',
          Telefono: c.Telefono || c.telefono || c.TELEFONO || '',
          Estado: c.Estado !== undefined ? c.Estado : (c.estado !== undefined ? c.estado : 1)
        }));
        setClientes(clientesNormalizados);
      }
    } catch (err) {
      console.error('Error al cargar datos de clientes:', err);
      setErrorCarga(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleGuardarNuevo = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('https://lunariasuites.onrender.com/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(nuevoCliente)
      });

      if (res.ok) {
        setModalAgregar(false);
        setNuevoCliente({ Nombre: '', Email: '', Telefono: '', Estado: 1 });
        cargarDatos();
        setAlertaMsg('Cliente registrado con éxito.');
      } else {
        setAlertaMsg('Error al registrar el cliente.');
      }
    } catch (err) {
      console.error('Error al guardar:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`https://lunariasuites.onrender.com/api/clientes/${clienteEditando.idClientes}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(clienteEditando)
      });

      if (res.ok) {
        setClienteEditando(null);
        cargarDatos();
        setAlertaMsg('Cliente actualizado correctamente.');
      } else {
        setAlertaMsg('Error al actualizar el cliente.');
      }
    } catch (err) {
      console.error('Error al editar:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const ejecutarEliminacion = async () => {
    try {
      const res = await fetch(`https://lunariasuites.onrender.com/api/clientes/${confirmarEliminarId}`, { method: 'DELETE', headers: authHeaders() });

      if (res.ok) {
        setConfirmarEliminarId(null);
        cargarDatos();
        setAlertaMsg('Cliente eliminado correctamente.');
      } else {
        setAlertaMsg('Error al eliminar el cliente.');
      }
    } catch (err) {
      console.error('Error al eliminar:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const clientesFiltrados = clientes.filter(item => [item.Nombre, item.Email, item.Telefono].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(filtroModulo.trim().toLocaleLowerCase('es')));

  return (
    <>
      <div className="roles-header-card">
        <h2>Clientes</h2>
        <button className="btn-add-role" onClick={() => setModalAgregar(true)}>
          <Plus size={24} />
        </button>
      </div>

      <div className="admin-filter-bar"><input value={filtroModulo} onChange={e=>setFiltroModulo(e.target.value)} placeholder="Filtrar clientes..."/></div>
      <div className="roles-table-container">
        <div className="table-header" style={{ display: 'grid', gridTemplateColumns: 'minmax(55px,.45fr) minmax(165px,1.2fr) minmax(310px,2.2fr) minmax(175px,1.2fr) minmax(100px,.7fr) minmax(115px,.8fr)', gap: '22px', minWidth: '1050px', padding: '12px 15px', fontWeight: 'bold' }}>
          <span>ID</span>
          <span>Nombre</span>
          <span>Email</span>
          <span>Teléfono</span>
          <span>Estado</span>
          <span>Acciones</span>
        </div>

        {cargando ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#555' }}>
            Cargando clientes desde la base de datos...
          </div>
        ) : errorCarga ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#e74c3c' }}>
            ⚠️ {errorCarga}.
          </div>
        ) : clientes.length > 0 ? (
          clientesFiltrados.map((c) => (
            <div 
              className="role-row" 
              key={c.idClientes} 
              style={{ display: 'grid', gridTemplateColumns: 'minmax(55px,.45fr) minmax(165px,1.2fr) minmax(310px,2.2fr) minmax(175px,1.2fr) minmax(100px,.7fr) minmax(115px,.8fr)', gap: '22px', minWidth: '1050px', alignItems: 'center', padding: '12px 15px' }}
            >
              <span>{c.idClientes}</span>
              <span><strong>{c.Nombre}</strong></span>
              <span title={c.Email} style={{minWidth:0,maxWidth:'100%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingRight:'10px'}}>{c.Email}</span>
              <span style={{minWidth:0,whiteSpace:'nowrap'}}>{c.Telefono}</span>
              <span>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  backgroundColor: Number(c.Estado) === 1 ? '#d4edda' : '#f8d7da',
                  color: Number(c.Estado) === 1 ? '#155724' : '#721c24'
                }}>
                  {Number(c.Estado) === 1 ? 'Activo' : 'Inactivo'}
                </span>
              </span>
              <div className="row-actions" style={{ display: 'flex', gap: '10px' }}>
                <Pencil 
                  className="action-icon" 
                  size={18} 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => setClienteEditando({ ...c })} 
                />
                <Trash2 
                  className="action-icon" 
                  size={18} 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => setConfirmarEliminarId(c.idClientes)} 
                />
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '30px', textAlign: 'center', color: '#777' }}>
            No se encontraron clientes en la base de datos.
          </div>
        )}
      </div>

      {/* MODAL CREAR */}
      {modalAgregar && (
        createPortal(<div className="modal-overlay">
          <form className="modal-content" onSubmit={handleGuardarNuevo}>
            <h3>Agregar Nuevo Cliente</h3>
            <div className="modal-field">
              <label>Nombre Completo</label>
              <input 
                type="text" 
                required 
                value={nuevoCliente.Nombre}
                onChange={(e) => setNuevoCliente({ ...nuevoCliente, Nombre: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Correo Electrónico</label>
              <input 
                type="email" 
                required 
                value={nuevoCliente.Email}
                onChange={(e) => setNuevoCliente({ ...nuevoCliente, Email: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Teléfono</label>
              <input 
                type="text" 
                required 
                value={nuevoCliente.Telefono}
                onChange={(e) => setNuevoCliente({ ...nuevoCliente, Telefono: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Estado</label>
              <select 
                value={nuevoCliente.Estado}
                onChange={(e) => setNuevoCliente({ ...nuevoCliente, Estado: Number(e.target.value) })}
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
      {clienteEditando && (
        createPortal(<div className="modal-overlay">
          <form className="modal-content" onSubmit={handleGuardarEdicion}>
            <h3>Editar Cliente</h3>
            <div className="modal-field">
              <label>Nombre Completo</label>
              <input 
                type="text" 
                required 
                value={clienteEditando.Nombre}
                onChange={(e) => setClienteEditando({ ...clienteEditando, Nombre: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Correo Electrónico</label>
              <input 
                type="email" 
                required 
                value={clienteEditando.Email}
                onChange={(e) => setClienteEditando({ ...clienteEditando, Email: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Teléfono</label>
              <input 
                type="text" 
                required 
                value={clienteEditando.Telefono}
                onChange={(e) => setClienteEditando({ ...clienteEditando, Telefono: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Estado</label>
              <select 
                value={clienteEditando.Estado}
                onChange={(e) => setClienteEditando({ ...clienteEditando, Estado: Number(e.target.value) })}
              >
                <option value={1}>Activo</option>
                <option value={0}>Inactivo</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancelar" onClick={() => setClienteEditando(null)}>Cancelar</button>
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
              ¿Deseas eliminar este cliente permanentemente?
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