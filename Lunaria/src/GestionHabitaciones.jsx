import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './GestionHabitaciones.css';
import { Plus, Pencil, Trash2, Image as ImageIcon, BedDouble, CheckCircle2, Ban, Wrench, Search, Building2, UserRound } from 'lucide-react';

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

export default function GestionHabitaciones() {
  const [filtroModulo, setFiltroModulo] = useState('');
  const [habitaciones, setHabitaciones] = useState([]);
  const [unidadesFisicas, setUnidadesFisicas] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [filtroSede, setFiltroSede] = useState('Todas');
  const [filtroEstadoFisico, setFiltroEstadoFisico] = useState('Todas');
  const [mostrarUnidadesFisicas, setMostrarUnidadesFisicas] = useState(false);
  const [actualizandoUnidad, setActualizandoUnidad] = useState(null);
  const [modalAgregar, setModalAgregar] = useState(false);
  const [habitacionEditando, setHabitacionEditando] = useState(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState(null);
  const [alertaMsg, setAlertaMsg] = useState(null);

  const [nuevaHabitacion, setNuevaHabitacion] = useState({
    tipo: '',
    capacidad: '',
    cantidad: '1',
    idSedeFK: '1',
    precio: '',
    estado: 1,
    descripcion: '',
    imagen: ''
  });

  const cargarHabitaciones = useCallback(async () => {
    try {
      const res = await fetch('https://lunariasuites.onrender.com/api/habitaciones', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHabitaciones(data);
      }
      const unidadesRes = await fetch('https://lunariasuites.onrender.com/api/habitaciones/unidades', { headers: authHeaders() });
      const sedesRes = await fetch('https://lunariasuites.onrender.com/api/sedes'); if (sedesRes.ok) setSedes(await sedesRes.json());
      if (unidadesRes.ok) setUnidadesFisicas(await unidadesRes.json());
    } catch (err) {
      console.error('Error al cargar habitaciones:', err);
    }
  }, []);

  useEffect(() => {
    cargarHabitaciones();
  }, [cargarHabitaciones]);

  const handleGuardarNueva = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('https://lunariasuites.onrender.com/api/habitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          ...nuevaHabitacion,
          idSedeFK: Number(nuevaHabitacion.idSedeFK || 1),
          precio: parseFloat(nuevaHabitacion.precio) || 0
        })
      });

      if (res.ok) {
        setModalAgregar(false);
        cargarHabitaciones();
        setAlertaMsg('Habitación creada correctamente.');
        setNuevaHabitacion({ tipo: '', capacidad: '', cantidad: '1', idSedeFK: '1', precio: '', estado: 1, descripcion: '', imagen: '' });
      } else {
        setAlertaMsg('No se pudo guardar la habitación.');
      }
    } catch (err) {
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`https://lunariasuites.onrender.com/api/habitaciones/${habitacionEditando.idHabitaciones}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          ...habitacionEditando,
          idSedeFK: Number(habitacionEditando.idSedeFK || 1),
          precio: parseFloat(habitacionEditando.precio) || 0
        })
      });

      if (res.ok) {
        setHabitacionEditando(null);
        cargarHabitaciones();
        setAlertaMsg('Habitación actualizada con éxito.');
      } else {
        setAlertaMsg('No se pudo actualizar la habitación.');
      }
    } catch (err) {
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const ejecutarEliminacion = async () => {
    try {
      const res = await fetch(`https://lunariasuites.onrender.com/api/habitaciones/${confirmarEliminarId}`, { method: 'DELETE', headers: authHeaders() });

      if (res.ok) {
        setConfirmarEliminarId(null);
        cargarHabitaciones();
        setAlertaMsg('Habitación eliminada correctamente.');
      } else {
        setAlertaMsg('No se pudo eliminar la habitación.');
      }
    } catch (err) {
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const cambiarEstadoUnidad = async (unidad, nuevoEstado) => {
    setActualizandoUnidad(unidad.idUnidad);
    try {
      const res = await fetch(`https://lunariasuites.onrender.com/api/habitaciones/unidades/${unidad.idUnidad}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAlertaMsg(data.mensaje || 'No se pudo actualizar el estado de la habitación.');
        return;
      }
      await cargarHabitaciones();
      setAlertaMsg(`La habitación ${unidad.numeroHabitacion} ahora está ${nuevoEstado === 'Mantenimiento' ? 'en mantenimiento' : 'disponible'}.`);
    } catch (err) {
      setAlertaMsg('Error de conexión al actualizar el estado físico.');
    } finally {
      setActualizandoUnidad(null);
    }
  };

  const unidadesDeSede = unidadesFisicas.filter(u => filtroSede === 'Todas' || String(u.idSedeFK) === String(filtroSede));
  const conteoEstados = {
    Todas: unidadesDeSede.length,
    Disponible: unidadesDeSede.filter(u => u.estado === 'Disponible').length,
    Ocupada: unidadesDeSede.filter(u => u.estado === 'Ocupada').length,
    Mantenimiento: unidadesDeSede.filter(u => ['Mantenimiento', 'No disponible'].includes(u.estado)).length
  };
  const textoBusqueda = filtroModulo.trim().toLocaleLowerCase('es');
  const unidadesFiltradas = unidadesFisicas.filter((unidad) => {
    const coincideEstado = filtroEstadoFisico === 'Todas'
      || (filtroEstadoFisico === 'Mantenimiento'
        ? ['Mantenimiento', 'No disponible'].includes(unidad.estado)
        : unidad.estado === filtroEstadoFisico);
    const texto = [unidad.numeroHabitacion, unidad.idUnidad, unidad.tipo, unidad.huesped]
      .filter(Boolean).join(' ').toLocaleLowerCase('es');
    const coincideSede = filtroSede === 'Todas' || String(unidad.idSedeFK) === String(filtroSede);
    return coincideEstado && coincideSede && (!textoBusqueda || texto.includes(textoBusqueda));
  });

  const habitacionesFiltrados = habitaciones.filter(item => (filtroSede === 'Todas' || String(item.idSedeFK) === String(filtroSede)) && [item.tipo, item.capacidad, item.descripcion, item.idHabitaciones, item.precio, item.estado].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(filtroModulo.trim().toLocaleLowerCase('es')));

  return (
    <>
      <div className="roles-header-card">
        <h2>Gestión de Habitaciones</h2>
        <button className="btn-add-role" onClick={() => setModalAgregar(true)}>
          <Plus size={24} />
        </button>
      </div>

      <section className="roles-table-container lunaria-room-dashboard" style={{ marginBottom: 18, padding: 16 }}>
        <div className="lunaria-room-toolbar">
          <label className="lunaria-room-search"><Search size={18}/><input value={filtroModulo} onChange={e=>setFiltroModulo(e.target.value)} placeholder="Buscar por número de habitación o huésped..."/></label>
          <label className="lunaria-room-search"><Building2 size={16}/><select value={filtroSede} onChange={e=>setFiltroSede(e.target.value)}><option value="Todas">Todas las sedes</option>{sedes.map(s=><option key={s.idSedes} value={s.idSedes}>{s.ciudad}</option>)}</select></label>
          <div className="lunaria-room-filters">
            {[
              { id: 'Todas', label: 'Todas', icon: BedDouble },
              { id: 'Disponible', label: 'Disponibles', icon: CheckCircle2 },
              { id: 'Ocupada', label: 'Ocupadas', icon: UserRound },
              { id: 'Mantenimiento', label: 'Mantenimiento', icon: Wrench }
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setFiltroEstadoFisico(id)}
                aria-pressed={filtroEstadoFisico === id} className={`lunaria-room-filter ${filtroEstadoFisico === id ? 'selected' : ''} ${id.toLowerCase()}`}>
                <Icon size={15}/><span>{label}</span><b>{conteoEstados[id]}</b>
              </button>
            ))}
          </div>
        </div>
        <div className="lunaria-room-collapse-bar"><strong>Inventario físico ({unidadesFiltradas.length})</strong><button type="button" onClick={() => setMostrarUnidadesFisicas(v => !v)}>{mostrarUnidadesFisicas ? 'Ocultar habitaciones' : 'Mostrar habitaciones'}</button></div>
        {mostrarUnidadesFisicas && <div className="lunaria-room-grid">
          {unidadesFiltradas.map((unidad) => {
            const estado = unidad.estado === 'No disponible' ? 'Mantenimiento' : unidad.estado;
            const color = estado === 'Disponible' ? '#16834a' : estado === 'Ocupada' ? '#b7791f' : '#b42318';
            return (
              <article key={unidad.idUnidad} className={`lunaria-room-unit-card ${estado.toLowerCase()}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <strong style={{ fontSize: 17 }}>#{unidad.numeroHabitacion}</strong>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: color }} />
                </div>
                <div style={{ margin: '5px 0 5px', color: '#666', fontSize: 13 }}>{unidad.tipo}</div>
                <small className="lunaria-room-unit-id">ID físico: {unidad.idUnidad}</small>
                {unidad.ciudadSede && <small className="lunaria-room-guest">Sede: {unidad.ciudadSede}</small>}
                {unidad.huesped && <small className="lunaria-room-guest">Huésped: {unidad.huesped}</small>}

                <span className={`status-badge ${estado === 'Disponible' ? 'active' : estado === 'Ocupada' ? 'pending' : 'inactive'}`}>{estado}</span>
                {estado !== 'Ocupada' && Number(unidad.estadoTipo) === 1 && (
                  <select aria-label={`Estado físico habitación ${unidad.numeroHabitacion}`}
                    value={unidad.estadoUnidad}
                    disabled={actualizandoUnidad === unidad.idUnidad}
                    onChange={e => cambiarEstadoUnidad(unidad, e.target.value)}
                    style={{ width: '100%', marginTop: 9, padding: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 12 }}>
                    <option value="Disponible">Disponible</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                  </select>
                )}
              </article>
            );
          })}
          {unidadesFiltradas.length === 0 && (
            <p className="lunaria-room-empty">
              No hay habitaciones en este estado.
            </p>
          )}
        </div>}
      </section>
      <div className="roles-table-container habitaciones-table">
        <div className="habitaciones-table-scroll">
          <table className="habitaciones-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Imagen</th>
                <th>Tipo</th>
                <th>Capacidad</th>
                <th>Unidades</th>
                <th>Precio / Noche</th>
                <th>Estado</th>
                <th>Descripción</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {habitacionesFiltrados.length > 0 ? (
                habitacionesFiltrados.map((hab) => (
                  <tr key={hab.idHabitaciones}>
                    <td>{hab.idHabitaciones}</td>
                    <td>
                      {hab.imagen ? (
                        <img src={hab.imagen} alt={hab.tipo} />
                      ) : (
                        <div className="habitacion-sin-imagen"><ImageIcon size={20} color="#999" /></div>
                      )}
                    </td>
                    <td><strong>{hab.tipo}</strong></td>
                    <td>{hab.capacidad}</td>
                    <td>{Number(hab.cantidad || 1)}</td>
                    <td><strong>${Number(hab.precio || hab.precioNoche || 0).toLocaleString('es-CO')}</strong></td>
                    <td>
                      <span className={`status-badge ${Number(hab.estado) === 1 ? 'active' : 'inactive'}`}>
                        {Number(hab.estado) === 1 ? 'Disponible' : 'Mantenimiento'}
                      </span>
                    </td>
                    <td className="habitacion-descripcion">{hab.descripcion || 'Sin descripción'}</td>
                    <td>
                      <div className="row-actions habitacion-acciones">
                        <Pencil className="action-icon" size={18}
                          onClick={() => setHabitacionEditando({ ...hab, precio: hab.precio || hab.precioNoche || 0 })} />
                        <Trash2 className="action-icon" size={18}
                          onClick={() => setConfirmarEliminarId(hab.idHabitaciones)} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="9" className="habitaciones-sin-resultados">No hay habitaciones que coincidan con la búsqueda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL AGREGAR */}
      {modalAgregar && (
        createPortal(<div className="modal-overlay">
          <form className="modal-content" onSubmit={handleGuardarNueva}>
            <h3>Agregar Nueva Habitación</h3>
            <div className="modal-field">
              <label>Tipo de Habitación</label>
              <input 
                type="text" 
                placeholder="Ej. Suite, Doble, Individual" 
                value={nuevaHabitacion.tipo} 
                onChange={(e) => setNuevaHabitacion({ ...nuevaHabitacion, tipo: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-field">
              <label>Capacidad</label>
              <input 
                type="text" 
                placeholder="Ej. 2 personas" 
                value={nuevaHabitacion.capacidad} 
                onChange={(e) => setNuevaHabitacion({ ...nuevaHabitacion, capacidad: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-field">
              <label>Cantidad de habitaciones de este tipo</label>
              <input type="number" min="1" step="1" value={nuevaHabitacion.cantidad || '1'} onChange={(e) => setNuevaHabitacion({ ...nuevaHabitacion, cantidad: e.target.value })} required />
              <small>Unidades físicas disponibles de esta categoría. El sistema descontará las reservadas por fecha.</small>
            </div>
            <div className="modal-field"><label>Sede / Ciudad</label><select value={nuevaHabitacion.idSedeFK || '1'} onChange={e=>setNuevaHabitacion({...nuevaHabitacion,idSedeFK:e.target.value})} required>{sedes.map(s=><option key={s.idSedes} value={s.idSedes}>{s.nombre} · {s.ciudad}</option>)}</select></div>
            <div className="modal-field">
              <label>Precio por Noche ($)</label>
              <input 
                type="number" 
                placeholder="Ej. 150000" 
                value={nuevaHabitacion.precio} 
                onChange={(e) => setNuevaHabitacion({ ...nuevaHabitacion, precio: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-field">
              <label>Imagen de la Habitación</label>
              <select
                value={nuevaHabitacion.imagen}
                onChange={(e) => setNuevaHabitacion({ ...nuevaHabitacion, imagen: e.target.value })}
              >
                <option value="">-- Seleccionar Imagen --</option>
                <option value="/habitaciones/senci.jpg">Sencilla (senci.jpg)</option>
                <option value="/habitaciones/doble.jpg">Doble (doble.jpg)</option>
                <option value="/habitaciones/Familiar.jpg">Familiar (Familiar.jpg)</option>
                <option value="/habitaciones/Suite.jpg">Suite (Suite.jpg)</option>
              </select>
            </div>
            <div className="modal-field">
              <label>Estado</label>
              <select 
                value={nuevaHabitacion.estado} 
                onChange={(e) => setNuevaHabitacion({ ...nuevaHabitacion, estado: parseInt(e.target.value) })}
              >
                <option value={1}>Disponible</option>
                <option value={0}>No disponible / Mantenimiento</option>
              </select>
            </div>
            <div className="modal-field">
              <label>Descripción</label>
              <input 
                type="text" 
                placeholder="Ej. Cama King, Balcón, Vista al mar" 
                value={nuevaHabitacion.descripcion} 
                onChange={(e) => setNuevaHabitacion({ ...nuevaHabitacion, descripcion: e.target.value })} 
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancelar" onClick={() => setModalAgregar(false)}>Cancelar</button>
              <button type="submit" className="btn-guardar">Guardar</button>
            </div>
          </form>
        </div>, document.body)
      )}

      {/* MODAL EDITAR */}
      {habitacionEditando && (
        createPortal(<div className="modal-overlay">
          <form className="modal-content" onSubmit={handleGuardarEdicion}>
            <h3>Editar Habitación #{habitacionEditando.idHabitaciones}</h3>
            <div className="modal-field">
              <label>Tipo</label>
              <input 
                type="text" 
                value={habitacionEditando.tipo} 
                onChange={(e) => setHabitacionEditando({ ...habitacionEditando, tipo: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-field">
              <label>Capacidad</label>
              <input 
                type="text" 
                value={habitacionEditando.capacidad} 
                onChange={(e) => setHabitacionEditando({ ...habitacionEditando, capacidad: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-field">
              <label>Cantidad de habitaciones de este tipo</label>
              <input type="number" min="1" step="1" value={habitacionEditando.cantidad || 1} onChange={(e) => setHabitacionEditando({ ...habitacionEditando, cantidad: e.target.value })} required />
              <small>Unidades físicas de esta categoría.</small>
            </div>
            <div className="modal-field"><label>Sede predeterminada para nuevas unidades</label><select value={habitacionEditando.idSedeFK || '1'} onChange={e=>setHabitacionEditando({...habitacionEditando,idSedeFK:e.target.value})} required>{sedes.map(s=><option key={s.idSedes} value={s.idSedes}>{s.nombre} · {s.ciudad}</option>)}</select></div>
            <div className="modal-field">
              <label>Precio por Noche ($)</label>
              <input 
                type="number" 
                value={habitacionEditando.precio} 
                onChange={(e) => setHabitacionEditando({ ...habitacionEditando, precio: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-field">
              <label>Imagen de la Habitación</label>
              <select
                value={habitacionEditando.imagen || ''}
                onChange={(e) => setHabitacionEditando({ ...habitacionEditando, imagen: e.target.value })}
              >
                <option value="">-- Seleccionar Imagen --</option>
                <option value="/habitaciones/senci.jpg">Sencilla (senci.jpg)</option>
                <option value="/habitaciones/doble.jpg">Doble (doble.jpg)</option>
                <option value="/habitaciones/Familiar.jpg">Familiar (Familiar.jpg)</option>
                <option value="/habitaciones/Suite.jpg">Suite (Suite.jpg)</option>
              </select>
            </div>
            <div className="modal-field">
              <label>Estado</label>
              <select 
                value={habitacionEditando.estado} 
                onChange={(e) => setHabitacionEditando({ ...habitacionEditando, estado: parseInt(e.target.value) })}
              >
                <option value={1}>Disponible</option>
                <option value={0}>No disponible / Mantenimiento</option>
              </select>
            </div>
            <div className="modal-field">
              <label>Descripción</label>
              <input 
                type="text" 
                value={habitacionEditando.descripcion || ''} 
                onChange={(e) => setHabitacionEditando({ ...habitacionEditando, descripcion: e.target.value })} 
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancelar" onClick={() => setHabitacionEditando(null)}>Cancelar</button>
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
            <p style={{ margin: '15px 0' }}>¿Deseas eliminar esta habitación?</p>
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