import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Send, RefreshCw } from 'lucide-react';

const API = 'https://lunariasuites.onrender.com/api';
export default function GestionComentarios({ sesion, clienteOnly = false }) {
  const [comentarios, setComentarios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteActivo, setClienteActivo] = useState(String(sesion?.usuario?.idClientesFK || ''));
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
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
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (clienteOnly) return;
    fetch(`${API}/clientes`, { headers }).then(r=>r.ok?r.json():[]).then(d=>setClientes(Array.isArray(d)?d:[])).catch(()=>setClientes([]));
  }, [clienteOnly, token]);
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
  const filtrados = clienteOnly ? comentarios : comentarios.filter(c=>String(c.idClientesFK)===String(clienteActivo));
  return <section className="lunaria-comments-panel">
    <header><div><MessageCircle size={22}/><h2>{clienteOnly ? 'Conversación con soporte' : 'Comentarios y soporte'}</h2></div><button type="button" onClick={cargar}><RefreshCw size={16}/> Actualizar</button></header>
    {!clienteOnly && <label className="lunaria-comments-client">Conversación del cliente<select value={clienteActivo} onChange={e=>setClienteActivo(e.target.value)}><option value="">Selecciona un cliente</option>{clientes.map(c=><option key={c.idClientes} value={c.idClientes}>{c.Nombre} · {c.Email}</option>)}</select></label>}
    <div className="lunaria-comments-list">{filtrados.map(c=><article key={c.idComentario} className={Number(c.idUsuariosFK)===Number(sesion?.usuario?.idUsuarios) ? 'mine' : ''}><div><strong>{c.autor || 'Usuario'}</strong><small>{c.rolAutor || 'Cliente'} · {new Date(c.fechaCreacion).toLocaleString('es-CO')}</small></div><p>{c.mensaje}</p></article>)}{!filtrados.length && <p className="lunaria-comments-empty">Aún no hay mensajes en esta conversación.</p>}</div>
    {(!clienteOnly && clienteActivo || clienteOnly) && <form onSubmit={publicar}><textarea value={mensaje} onChange={e=>setMensaje(e.target.value)} maxLength={2000} rows={3} placeholder="Escribe tu comentario o respuesta..." required/><button type="submit" disabled={!mensaje.trim()}><Send size={16}/> Enviar</button></form>}
    {error && <p role="alert" className="lunaria-comments-error">{error}</p>}
  </section>;
}
