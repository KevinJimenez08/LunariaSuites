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

export default function GestionPaquetes() {
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroSede, setFiltroSede] = useState('Todas');
  const [paquetes, setPaquetes] = useState([]);
  const [habitaciones, setHabitaciones] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [modalAgregar, setModalAgregar] = useState(false);
  const [paqueteEditando, setPaqueteEditando] = useState(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState(null);
  const [alertaMsg, setAlertaMsg] = useState(null);

  const [nuevoPaquete, setNuevoPaquete] = useState({
    nomPaquete: '',
    tipo: '',
    descripcion: '',
    precioPaquete: '',
    imagen: '',
    idHabitacionesFK: '',
    idSedeFK: '1',
    serviciosIncluidos: []
  });

  const obtenerPaquetes = useCallback(async () => {
    try {
      const res = await fetch('https://lunariasuites.onrender.com/api/paquetes', { headers: authHeaders() });
      if (!res.ok) throw new Error('Error al obtener paquetes');
      const data = await res.json();
      setPaquetes(data);
    } catch (err) {
      console.error('Error al cargar paquetes:', err);
    }
  }, []);

  useEffect(() => {
    obtenerPaquetes();
    const cargarCatalogos = async () => {
      try {
        const [rh, rs] = await Promise.all([
          fetch('https://lunariasuites.onrender.com/api/habitaciones', { headers: authHeaders() }),
          fetch('https://lunariasuites.onrender.com/api/servicios', { headers: authHeaders() }),
        ]);
        if (rh.ok) setHabitaciones((await rh.json()).filter(h => Number(h.estado) === 1 || h.estado == null));
        if (rs.ok) setServicios((await rs.json()).filter(s => Number(s.estado) === 1 || s.estado == null));
        const sedeResponse = await fetch('https://lunariasuites.onrender.com/api/sedes'); if (sedeResponse.ok) setSedes(await sedeResponse.json());
      } catch (e) { console.error('No se pudieron cargar habitaciones/servicios:', e); }
    };
    cargarCatalogos();
  }, [obtenerPaquetes]);

  const handleGuardarNuevo = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('https://lunariasuites.onrender.com/api/paquetes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          ...nuevoPaquete,
          precioPaquete: parseFloat(nuevoPaquete.precioPaquete),
          idHabitacionesFK: Number(nuevoPaquete.idHabitacionesFK),
          idSedeFK: Number(nuevoPaquete.idSedeFK || 1),
          serviciosIncluidos: nuevoPaquete.serviciosIncluidos
        })
      });

      if (res.ok) {
        setModalAgregar(false);
        setNuevoPaquete({ nomPaquete: '', tipo: '', descripcion: '', precioPaquete: '', imagen: '', idHabitacionesFK: '', idSedeFK: '1', serviciosIncluidos: [] });
        obtenerPaquetes();
        setAlertaMsg('Paquete creado exitosamente.');
      } else {
        setAlertaMsg('No se pudo crear el paquete.');
      }
    } catch (err) {
      console.error('Error al agregar paquete:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`https://lunariasuites.onrender.com/api/paquetes/${paqueteEditando.idPaquetes}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          ...paqueteEditando,
          precioPaquete: parseFloat(paqueteEditando.precioPaquete),
          idHabitacionesFK: Number(paqueteEditando.idHabitacionesFK),
          idSedeFK: Number(paqueteEditando.idSedeFK || 1),
          serviciosIncluidos: paqueteEditando.serviciosIncluidos || []
        })
      });

      if (res.ok) {
        setPaqueteEditando(null);
        obtenerPaquetes();
        setAlertaMsg('Paquete actualizado con éxito.');
      } else {
        setAlertaMsg('No se pudo actualizar el paquete.');
      }
    } catch (err) {
      console.error('Error al actualizar paquete:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const ejecutarEliminacion = async () => {
    try {
      const res = await fetch(`https://lunariasuites.onrender.com/api/paquetes/${confirmarEliminarId}`, { method: 'DELETE', headers: authHeaders() });

      if (res.ok) {
        setConfirmarEliminarId(null);
        obtenerPaquetes();
        setAlertaMsg('Paquete eliminado correctamente.');
      } else {
        setAlertaMsg('No se pudo eliminar el paquete.');
      }
    } catch (err) {
      console.error('Error al eliminar paquete:', err);
      setAlertaMsg('Error de conexión con el servidor.');
    }
  };

  const paquetesFiltrados = paquetes.filter(item => (filtroSede === 'Todas' || String(item.idSedeFK) === String(filtroSede)) && [item.nomPaquete, item.tipo, item.descripcion, item.ciudad, item.nombreSede].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(filtroModulo.trim().toLocaleLowerCase('es')));
  const habitacionesDeSede = habitaciones.filter(h => String(h.idSedeFK) === String(nuevoPaquete.idSedeFK || '1'));
  const habitacionesEdicionDeSede = habitaciones.filter(h => String(h.idSedeFK) === String(paqueteEditando?.idSedeFK || '1'));

  return (
    <>
      <div className="roles-header-card">
        <h2>Listado de Paquetes</h2>
        <button 
          className="btn-add-role" 
          onClick={() => {
            setNuevoPaquete({ nomPaquete: '', tipo: '', descripcion: '', precioPaquete: '', imagen: '', idHabitacionesFK: '', idSedeFK: '1', serviciosIncluidos: [] });
            setModalAgregar(true);
          }}
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="admin-filter-bar"><select aria-label="Filtrar paquetes por sede" value={filtroSede} onChange={e=>setFiltroSede(e.target.value)}><option value="Todas">Todas las sedes</option>{sedes.map(s=><option key={s.idSedes} value={s.idSedes}>{s.nombre} · {s.ciudad}</option>)}</select><input value={filtroModulo} onChange={e=>setFiltroModulo(e.target.value)} placeholder="Filtrar paquetes..."/></div>
      <div className="roles-table-container">
        <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '60px 80px 1.2fr 1fr 2fr 1fr 90px', gap: '10px', alignItems: 'center' }}>
          <span>ID</span>
          <span>Imagen</span>
          <span>Nombre</span>
          <span>Tipo</span>
          <span>Descripción</span>
          <span>Precio</span>
          <span>Acciones</span>
        </div>

        {paquetes.length > 0 ? (
          paquetesFiltrados.map((paq) => (
            <div className="role-row" key={paq.idPaquetes} style={{ display: 'grid', gridTemplateColumns: '60px 80px 1.2fr 1fr 2fr 1fr 90px', gap: '10px', alignItems: 'center' }}>
              <span>{paq.idPaquetes}</span>
              <div>
                {paq.imagen ? <img src={paq.imagen} alt={paq.nomPaquete} onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #ccc' }} /> : <span style={{ color: '#888', fontSize: '12px' }}>Sin imagen</span>}
              </div>
              <span><strong>{paq.nomPaquete}</strong><small>{paq.ciudad || paq.nombreSede || 'Sede principal'}</small></span>
              <span>{paq.tipo || 'N/A'}</span>
              <span style={{ color: '#555', fontSize: '0.88rem' }}>{paq.descripcion || 'Sin descripción'}</span>
              <span>${Number(paq.precioPaquete || 0).toLocaleString('es-CO')}</span>
              <div className="row-actions">
                <Pencil 
                  className="action-icon" 
                  size={18} 
                  style={{ cursor: 'pointer', color: '#f39c12' }}
                  onClick={() => setPaqueteEditando({ ...paq, imagen: paq.imagen || '', idHabitacionesFK: String(paq.idHabitacionesFK || ''), serviciosIncluidos: paq.serviciosIncluidos || [] })} 
                />
                <Trash2 
                  className="action-icon" 
                  size={18} 
                  style={{ cursor: 'pointer', color: '#e74c3c' }}
                  onClick={() => setConfirmarEliminarId(paq.idPaquetes)} 
                />
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#777' }}>
            No hay paquetes registrados en la base de datos.
          </div>
        )}
      </div>

      {/* MODAL AGREGAR */}
      {modalAgregar && (
        createPortal(<div className="modal-overlay">
          <form className="modal-content" onSubmit={handleGuardarNuevo}>
            <h3>Agregar Nuevo Paquete</h3>
            <div className="modal-field">
              <label>Nombre del Paquete</label>
              <input 
                type="text" 
                placeholder="Ej. Romántico / Fin de Semana"
                value={nuevoPaquete.nomPaquete} 
                onChange={(e) => setNuevoPaquete({ ...nuevoPaquete, nomPaquete: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-field">
              <label>Tipo de Paquete</label>
              <input 
                type="text" 
                placeholder="Ej. Pareja / Grupo / Individual"
                value={nuevoPaquete.tipo} 
                onChange={(e) => setNuevoPaquete({ ...nuevoPaquete, tipo: e.target.value })} 
              />
            </div>
            <div className="modal-field">
              <label>Imagen del Paquete</label>
              <select 
                value={nuevoPaquete.imagen} 
                onChange={(e) => setNuevoPaquete({ ...nuevoPaquete, imagen: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="">Sin imagen</option>
                <option value="/paquetes/Aventura.jpg">Aventura.jpg</option>
                <option value="/paquetes/Escapada.jpg">Escapada.jpg</option>
                <option value="/paquetes/Gourmet.jpg">Gourmet.jpg</option>
                <option value="/paquetes/Relax.jpg">Relax.jpg</option>
                <option value="/paquetes/Romantico.jpg">Romantico.jpg</option>
              </select>
            </div>
            <div className="modal-field">
              <label>Descripción</label>
              <textarea 
                placeholder="Detalles de lo que incluye el paquete..."
                value={nuevoPaquete.descripcion} 
                onChange={(e) => setNuevoPaquete({ ...nuevoPaquete, descripcion: e.target.value })}
                rows="3"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical' }}
              />
            </div>
            <div className="modal-field"><label>Sede / Ciudad del paquete</label><select value={nuevoPaquete.idSedeFK || '1'} onChange={e=>setNuevoPaquete({...nuevoPaquete,idSedeFK:e.target.value,idHabitacionesFK:''})} required>{sedes.map(s=><option key={s.idSedes} value={s.idSedes}>{s.nombre} · {s.ciudad}</option>)}</select></div>
            <div className="modal-field">
              <label>Habitación incluida en el paquete</label>
              <select value={nuevoPaquete.idHabitacionesFK} onChange={e => setNuevoPaquete({ ...nuevoPaquete, idHabitacionesFK: e.target.value })} required>
                <option value="">Selecciona la habitación incluida</option>
                {habitacionesDeSede.map(h => <option key={h.idHabitaciones} value={h.idHabitaciones}>{h.tipo} — ${Number(h.precio || 0).toLocaleString('es-CO')} / noche (capacidad {h.capacidad})</option>)}
              </select>
              <small>El precio del paquete incluye esta habitación.</small>
            </div>
            <div className="modal-field">
              <label>Servicios incluidos</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '8px' }}>
                {servicios.map(s => <label key={s.idServicios} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input type="checkbox" checked={(nuevoPaquete.serviciosIncluidos || []).includes(Number(s.idServicios))} onChange={e => setNuevoPaquete({ ...nuevoPaquete, serviciosIncluidos: e.target.checked ? [...(nuevoPaquete.serviciosIncluidos || []), Number(s.idServicios)] : (nuevoPaquete.serviciosIncluidos || []).filter(id => id !== Number(s.idServicios)) })}/>{s.nombre}</label>)}
                {!servicios.length && <small>No hay servicios activos para incluir.</small>}
              </div>
            </div>
            <div className="modal-field">
              <label>Precio del Paquete</label>
              <input 
                type="number" 
                placeholder="Ej. 150000"
                value={nuevoPaquete.precioPaquete} 
                onChange={(e) => setNuevoPaquete({ ...nuevoPaquete, precioPaquete: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancelar" onClick={() => setModalAgregar(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn-guardar">Agregar Paquete</button>
            </div>
          </form>
        </div>, document.body)
      )}

      {/* MODAL EDITAR */}
      {paqueteEditando && (
        createPortal(<div className="modal-overlay">
          <form className="modal-content" onSubmit={handleGuardarEdicion}>
            <h3>Editar Paquete</h3>
            <div className="modal-field">
              <label>Nombre del Paquete</label>
              <input 
                type="text" 
                value={paqueteEditando.nomPaquete} 
                onChange={(e) => setPaqueteEditando({ ...paqueteEditando, nomPaquete: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-field">
              <label>Tipo de Paquete</label>
              <input 
                type="text" 
                value={paqueteEditando.tipo || ''} 
                onChange={(e) => setPaqueteEditando({ ...paqueteEditando, tipo: e.target.value })} 
              />
            </div>
            <div className="modal-field">
              <label>Imagen del Paquete</label>
              <select 
                value={paqueteEditando.imagen || ''} 
                onChange={(e) => setPaqueteEditando({ ...paqueteEditando, imagen: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="">Sin imagen</option>
                <option value="/paquetes/Aventura.jpg">Aventura.jpg</option>
                <option value="/paquetes/Escapada.jpg">Escapada.jpg</option>
                <option value="/paquetes/Gourmet.jpg">Gourmet.jpg</option>
                <option value="/paquetes/Relax.jpg">Relax.jpg</option>
                <option value="/paquetes/Romantico.jpg">Romantico.jpg</option>
              </select>
            </div>
            <div className="modal-field">
              <label>Descripción</label>
              <textarea 
                value={paqueteEditando.descripcion || ''} 
                onChange={(e) => setPaqueteEditando({ ...paqueteEditando, descripcion: e.target.value })}
                rows="3"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical' }}
              />
            </div>
            <div className="modal-field"><label>Sede / Ciudad del paquete</label><select value={paqueteEditando.idSedeFK || '1'} onChange={e=>setPaqueteEditando({...paqueteEditando,idSedeFK:e.target.value,idHabitacionesFK:''})} required>{sedes.map(s=><option key={s.idSedes} value={s.idSedes}>{s.nombre} · {s.ciudad}</option>)}</select></div>
            <div className="modal-field">
              <label>Habitación incluida en el paquete</label>
              <select value={paqueteEditando.idHabitacionesFK || ''} onChange={e => setPaqueteEditando({ ...paqueteEditando, idHabitacionesFK: e.target.value })} required>
                <option value="">Selecciona la habitación incluida</option>
                {habitacionesEdicionDeSede.map(h => <option key={h.idHabitaciones} value={h.idHabitaciones}>{h.tipo} — ${Number(h.precio || 0).toLocaleString('es-CO')} / noche (capacidad {h.capacidad})</option>)}
              </select>
              <small>El precio del paquete incluye esta habitación.</small>
            </div>
            <div className="modal-field">
              <label>Servicios incluidos</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '8px' }}>
                {servicios.map(s => <label key={s.idServicios} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input type="checkbox" checked={(paqueteEditando.serviciosIncluidos || []).map(Number).includes(Number(s.idServicios))} onChange={e => setPaqueteEditando({ ...paqueteEditando, serviciosIncluidos: e.target.checked ? [...(paqueteEditando.serviciosIncluidos || []).map(Number), Number(s.idServicios)] : (paqueteEditando.serviciosIncluidos || []).map(Number).filter(id => id !== Number(s.idServicios)) })}/>{s.nombre}</label>)}
                {!servicios.length && <small>No hay servicios activos para incluir.</small>}
              </div>
            </div>
            <div className="modal-field">
              <label>Precio del Paquete</label>
              <input 
                type="number" 
                value={paqueteEditando.precioPaquete || ''} 
                onChange={(e) => setPaqueteEditando({ ...paqueteEditando, precioPaquete: e.target.value })} 
                required 
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancelar" onClick={() => setPaqueteEditando(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-guardar">Guardar Cambios</button>
            </div>
          </form>
        </div>, document.body)
      )}

      {/* MODALS ALERTA Y ELIMINAR */}
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

      {confirmarEliminarId && (
        createPortal(<div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center', width: '350px' }}>
            <h3>Confirmar Acción</h3>
            <p style={{ margin: '15px 0', fontSize: '1rem', color: '#333' }}>
              ¿Estás seguro de que deseas eliminar este paquete?
            </p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn-cancelar" onClick={() => setConfirmarEliminarId(null)}>Cancelar</button>
              <button className="btn-guardar" style={{ backgroundColor: '#e74c3c', color: '#fff' }} onClick={ejecutarEliminacion}>
                Eliminar
              </button>
            </div>
          </div>
        </div>, document.body)
      )}
    </>
  );
}