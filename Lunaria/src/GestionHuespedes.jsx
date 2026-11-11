import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Pencil } from 'lucide-react';

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

export default function GestionHuespedes() {
  const [filtroModulo, setFiltroModulo] = useState('');
  const [huespedes, setHuespedes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  const [modalAgregar, setModalAgregar] = useState(false);
  const [huespedEditando, setHuespedEditando] = useState(null); // Estado para editar
  const [confirmarEliminarId, setConfirmarEliminarId] = useState(null);
  const [alertaMsg, setAlertaMsg] = useState(null);

  const [nuevoHuesped, setNuevoHuesped] = useState({
    Nombre: '',
    idClientesFK: ''
  });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [resHue, resCli] = await Promise.all([
        fetch('http://localhost:3000/api/huespedes', { headers: authHeaders() }),
        fetch('http://localhost:3000/api/clientes', { headers: authHeaders() })
      ]);

      if (!resHue.ok) throw new Error('Error al obtener huéspedes');

      const dataHuespedes = await resHue.json();
      const dataClientes = resCli.ok ? await resCli.json() : [];

      setHuespedes(Array.isArray(dataHuespedes) ? dataHuespedes : []);
      setClientes(dataClientes);
    } catch (err) {
      console.error('Error al cargar datos de huéspedes:', err);
      setErrorCarga(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Guardar nuevo huésped
  const handleGuardarNueva = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/api/huespedes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(nuevoHuesped)
      });

      if (res.ok) {
        setModalAgregar(false);
        setNuevoHuesped({ Nombre: '', idClientesFK: '' });
        cargarDatos();
        setAlertaMsg('Huésped registrado exitosamente.');
      } else {
        setAlertaMsg('Error al registrar el huésped.');
      }
    } catch (err) {
      console.error('Error al guardar:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  // Actualizar huésped existente
  const handleActualizarHuesped = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:3000/api/huespedes/${huespedEditando.idHuespedes}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          Nombre: huespedEditando.Nombre || huespedEditando.NombreHuesped,
          idClientesFK: huespedEditando.idClientesFK
        })
      });

      if (res.ok) {
        setHuespedEditando(null);
        cargarDatos();
        setAlertaMsg('Huésped actualizado correctamente.');
      } else {
        setAlertaMsg('Error al actualizar el huésped.');
      }
    } catch (err) {
      console.error('Error al actualizar:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  // Eliminar huésped
  const ejecutarEliminacion = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/huespedes/${confirmarEliminarId}`, { method: 'DELETE', headers: authHeaders() });

      if (res.ok) {
        setConfirmarEliminarId(null);
        cargarDatos();
        setAlertaMsg('Huésped eliminado correctamente.');
      } else {
        setAlertaMsg('Error al eliminar el huésped.');
      }
    } catch (err) {
      console.error('Error al eliminar:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const huespedesFiltrados = huespedes.filter(item => [item.NombreHuesped, item.Nombre, item.NombreCliente].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(filtroModulo.trim().toLocaleLowerCase('es')));

  return (
    <>
      <div className="roles-header-card">
        <h2>Huéspedes</h2>
        <button className="btn-add-role" onClick={() => setModalAgregar(true)}>
          <Plus size={24} />
        </button>
      </div>

      <div className="admin-filter-bar"><input value={filtroModulo} onChange={e=>setFiltroModulo(e.target.value)} placeholder="Filtrar huespedes..."/><button type="button" onClick={()=>setFiltroModulo('')}>Limpiar</button></div>
      <div className="roles-table-container">
        <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '1fr 3fr 3fr 1fr', padding: '12px 15px', fontWeight: 'bold' }}>
          <span>ID</span>
          <span>Nombre del Huésped</span>
          <span>Cliente Asociado</span>
          <span>Acciones</span>
        </div>

        {cargando ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#555' }}>
            Cargando huéspedes...
          </div>
        ) : errorCarga ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#e74c3c' }}>
            ⚠️ {errorCarga}
          </div>
        ) : huespedes.length > 0 ? (
          huespedesFiltrados.map((h) => (
            <div 
              className="role-row" 
              key={h.idHuespedes} 
              style={{ display: 'grid', gridTemplateColumns: '1fr 3fr 3fr 1fr', alignItems: 'center', padding: '12px 15px' }}
            >
              <span>#{h.idHuespedes}</span>
              <span><strong>{h.NombreHuesped || h.Nombre}</strong></span>
              <span>{h.NombreCliente || `Cliente ID: ${h.idClientesFK}`}</span>
              <div className="row-actions" style={{ display: 'flex', gap: '10px' }}>
                <Pencil 
                  className="action-icon" 
                  size={18} 
                  style={{ cursor: 'pointer', color: '#f39c12' }} 
                  onClick={() => setHuespedEditando({ ...h, Nombre: h.NombreHuesped || h.Nombre })} 
                />
                <Trash2 
                  className="action-icon" 
                  size={18} 
                  style={{ cursor: 'pointer', color: '#e74c3c' }} 
                  onClick={() => setConfirmarEliminarId(h.idHuespedes)} 
                />
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '30px', textAlign: 'center', color: '#777' }}>
            No hay huéspedes registrados.
          </div>
        )}
      </div>

      {/* MODAL CREAR */}
      {modalAgregar && (
        createPortal(<div className="modal-overlay">
          <form className="modal-content" onSubmit={handleGuardarNueva}>
            <h3>Nuevo Huésped</h3>
            <div className="modal-field">
              <label>Nombre del Huésped</label>
              <input 
                type="text" 
                required
                placeholder="Nombre completo..."
                value={nuevoHuesped.Nombre}
                onChange={(e) => setNuevoHuesped({ ...nuevoHuesped, Nombre: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Cliente Titular / Asociado</label>
              <select 
                required 
                value={nuevoHuesped.idClientesFK}
                onChange={(e) => setNuevoHuesped({ ...nuevoHuesped, idClientesFK: e.target.value })}
              >
                <option value="">Seleccione un cliente...</option>
                {clientes.map((c) => (
                  <option key={c.idClientes} value={c.idClientes}>
                    {c.Nombre} (ID: {c.idClientes})
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancelar" onClick={() => setModalAgregar(false)}>Cancelar</button>
              <button type="submit" className="btn-guardar">Guardar Huésped</button>
            </div>
          </form>
        </div>, document.body)
      )}

      {/* MODAL EDITAR */}
      {huespedEditando && (
        createPortal(<div className="modal-overlay">
          <form className="modal-content" onSubmit={handleActualizarHuesped}>
            <h3>Editar Huésped</h3>
            <div className="modal-field">
              <label>Nombre del Huésped</label>
              <input 
                type="text" 
                required
                placeholder="Nombre completo..."
                value={huespedEditando.Nombre}
                onChange={(e) => setHuespedEditando({ ...huespedEditando, Nombre: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Cliente Titular / Asociado</label>
              <select 
                required 
                value={huespedEditando.idClientesFK}
                onChange={(e) => setHuespedEditando({ ...huespedEditando, idClientesFK: e.target.value })}
              >
                <option value="">Seleccione un cliente...</option>
                {clientes.map((c) => (
                  <option key={c.idClientes} value={c.idClientes}>
                    {c.Nombre} (ID: {c.idClientes})
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancelar" onClick={() => setHuespedEditando(null)}>Cancelar</button>
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
            <h3>Confirmar Eliminación</h3>
            <p style={{ margin: '15px 0', fontSize: '1rem', color: '#333' }}>
              ¿Seguro que deseas eliminar este huésped?
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