import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Send, RefreshCw } from 'lucide-react';

const API = 'https://lunariasuites.onrender.com/api';
export default function GestionComentarios({ sesion, clienteOnly = false, compact = false }) {
  const [comentarios, setComentarios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteActivo, setClienteActivo] = useState(String(sesion?.usuario?.idClientesFK || ''));
  const [vistaConversacion, setVistaConversacion] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [notificacionesChat, setNotificacionesChat] = useState([]);
  const token = sesion?.token || localStorage.getItem('lunariaToken') || '';
  const headers = { Authorization: `Bearer ${token}` };
  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`${API}/comentarios`, { headers });
      const d = await r.json();
      if (!r.ok) throw new Error(d.mensaje || 'No se pudieron cargar los comentarios.');
      setComentarios(Array.isArray(d) ? d : []);
    } catch (e) { setError(e.message); }
  }, [token]);
  useEffect(() => { cargar(); const timer=setInterval(cargar,10000); return ()=>clearInterval(timer); }, [cargar]);
  useEffect(() => {
    if (clienteOnly) return;
    fetch(`${API}/clientes/chat`, { headers }).then(r=>r.ok?r.json():[]).then(d=>setClientes(Array.isArray(d)?d:[])).catch(()=>setClientes([]));
  }, [clienteOnly, token]);
  useEffect(() => {
    if (clienteOnly) return;
    const cargarAvisos = async () => {
      try { const r=await fetch(`${API}/notificaciones`,{headers}); if(r.ok){const d=await r.json();setNotificacionesChat((Array.isArray(d)?d:[]).filter(n=>n.tipo==='chat_nuevo'&&!n.leida));} } catch {}
    };
    cargarAvisos(); const timer=setInterval(cargarAvisos,10000); return ()=>clearInterval(timer);
  }, [clienteOnly, token]);

  useEffect(() => {
    if (!clienteOnly && !clienteActivo && comentarios.length) {
      const primero = [...comentarios].filter(c => c.idClientesFK).sort((a,b)=>new Date(b.fechaCreacion||0)-new Date(a.fechaCreacion||0))[0];
      if (primero) setClienteActivo(String(primero.idClientesFK));
    }
  }, [clienteOnly, clienteActivo, comentarios]);

  const publicar = async e => {
    e.preventDefault(); setError('');
    if (!mensaje.trim()) return;
    try {
      const r = await fetch(`${API}/comentarios`, { method:'POST', headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify({mensaje:mensaje.trim(),idClientesFK:Number(clienteActivo)}) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.mensaje || 'No se pudo publicar.');
      setMensaje(''); await cargar();
    } catch (e) { setError(e.message); }
  };
  const hilos = !clienteOnly ? Object.values(comentarios.filter(c=>c.idClientesFK).reduce((acc,c)=>{
    const id=String(c.idClientesFK); const fecha=new Date(c.fechaCreacion||0).getTime();
    if(!acc[id] || fecha>=new Date(acc[id].fecha||0).getTime()) acc[id]={id,nombre:c.nombreCliente || c.autor || `Cliente #${id}`,email:c.emailCliente||'',ultimo:c.mensaje||'',fecha:c.fechaCreacion};
    return acc;
  },{})).sort((a,b)=>new Date(b.fecha||0)-new Date(a.fecha||0)) : [];
  const clienteSeleccionado = hilos.find(h=>h.id===String(clienteActivo));
  const filtrados = clienteOnly ? comentarios : comentarios.filter(c=>String(c.idClientesFK)===String(clienteActivo));
  const horaCorta = fecha => { const d=new Date(fecha); return Number.isNaN(d.getTime())?'':d.toLocaleDateString('es-CO',{day:'2-digit',month:'short'}); };
  const historial = <div className="lunaria-comments-list">{filtrados.map(c=><article key={c.idComentario} className={Number(c.idUsuariosFK)===Number(sesion?.usuario?.idUsuarios) ? 'mine' : ''}><div><strong>{c.autor || 'Usuario'}</strong><small>{!clienteOnly && c.nombreCliente ? `${c.nombreCliente} · ${c.emailCliente || ''} · ` : ''}{c.rolAutor || 'Cliente'} · {new Date(c.fechaCreacion).toLocaleString('es-CO')}</small></div><p>{c.mensaje}</p></article>)}{!filtrados.length && <p className="lunaria-comments-empty">Aún no hay mensajes en esta conversación.</p>}</div>;
  const formulario = (clienteOnly || (!clienteOnly && clienteActivo)) && <form onSubmit={publicar}><textarea value={mensaje} onChange={e=>setMensaje(e.target.value)} maxLength={2000} rows={compact ? 1 : 3} placeholder="Escribe tu comentario o respuesta..." required/><button type="submit" disabled={!mensaje.trim()}><Send size={16}/> Enviar</button></form>;
  return <section className={`lunaria-comments-panel ${clienteOnly?'lunaria-chat-client-view':'lunaria-chat-staff-view'} ${compact?'lunaria-chat-compact':''} ${compact && vistaConversacion ? 'is-conversation' : ''}`}>
    <header><div><MessageCircle size={22}/><h2>{clienteOnly ? 'Conversación con soporte' : 'Comentarios y soporte'}{!clienteOnly&&notificacionesChat.length>0&&<small style={{display:'block',color:'#b36b22'}}>{notificacionesChat.length} mensaje(s) nuevo(s) de clientes</small>}</h2></div><button type="button" onClick={cargar}><RefreshCw size={16}/> Actualizar</button></header>
    {clienteOnly ? <>{historial}{formulario}</> : <div className={`lunaria-chat-workspace ${compact && vistaConversacion ? 'is-conversation' : ''}`}>
      {(!compact || !vistaConversacion) && <aside className="lunaria-chat-inbox"><div className="lunaria-chat-inbox-heading"><h3>Conversaciones de clientes</h3><span>{hilos.length}</span></div>
        {hilos.length ? hilos.map(h=><button type="button" key={h.id} title={h.email || h.nombre} className={`lunaria-chat-thread ${String(clienteActivo)===h.id?'active':''}`} onClick={()=>{setClienteActivo(h.id); if(compact) setVistaConversacion(true);}}>
          <span className="lunaria-chat-avatar">{h.nombre.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}</span>
          <span className="lunaria-chat-thread-copy"><span className="lunaria-chat-thread-top"><strong>{h.nombre}</strong><time>{horaCorta(h.fecha)}</time></span><span className="lunaria-chat-thread-preview">{h.ultimo}</span></span>
        </button>) : <p className="lunaria-comments-empty">Todavía no hay mensajes de clientes.</p>}
      </aside>}
      {(!compact || vistaConversacion) && <main className="lunaria-chat-main">
        {clienteSeleccionado ? <><div className="lunaria-chat-conversation-heading">{compact && <button type="button" className="lunaria-chat-back" aria-label="Volver a la lista de chats" title="Volver" onClick={()=>setVistaConversacion(false)}>←</button>}<span className="lunaria-chat-avatar">{clienteSeleccionado.nombre.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}</span><div><strong>{clienteSeleccionado.nombre}</strong><small>{clienteSeleccionado.email || `Cliente #${clienteSeleccionado.id}`}</small></div></div>{historial}{formulario}</> : <div className="lunaria-chat-placeholder"><MessageCircle size={34}/><strong>Selecciona una conversación</strong><span>Elige un cliente de la lista para consultar el historial y responder.</span></div>}
      </main>}
    </div>}
    {error && <p role="alert" className="lunaria-comments-error">{error}</p>}
  </section>;
}
