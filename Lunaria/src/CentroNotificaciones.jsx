import {useCallback,useEffect,useState} from 'react';
import {Bell,Check,Trash2} from 'lucide-react';

export default function CentroNotificaciones({sesion}){
 const [items,setItems]=useState([]),[abierto,setAbierto]=useState(false);
 const token=sesion?.token||localStorage.getItem('lunariaToken')||'';
 const headers={Authorization:`Bearer ${token}`};
 const cargar=useCallback(async()=>{
  try{
   const r=await fetch('http://localhost:3000/api/notificaciones',{headers});
   if(r.ok){const data=await r.json();setItems(Array.isArray(data)?data:[]);}
  }catch{}
 },[token]);
 useEffect(()=>{cargar();const timer=setInterval(cargar,20000);return()=>clearInterval(timer);},[cargar]);
 const leer=async id=>{
  try{const r=await fetch(`http://localhost:3000/api/notificaciones/${id}/leida`,{method:'PATCH',headers});if(r.ok)setItems(prev=>prev.map(n=>n.idNotificacion===id?{...n,leida:1}:n));}
  catch{}
 };
 const eliminar=async id=>{
  try{const r=await fetch(`http://localhost:3000/api/notificaciones/${id}`,{method:'DELETE',headers});if(r.ok)setItems(prev=>prev.filter(n=>n.idNotificacion!==id));}
  catch{}
 };
 const pendientes=items.filter(x=>!x.leida).length;
 return <div className="lunaria-notifications" style={{position:'relative',margin:0}}>
  <button className="lunaria-notifications-trigger" type="button" aria-label="Notificaciones" aria-expanded={abierto} onClick={()=>setAbierto(v=>!v)}>
   <Bell size={19}/>{pendientes>0&&<span className="lunaria-notifications-count">{pendientes}</span>}
  </button>
  {abierto&&<div className="lunaria-notifications-panel">
   {items.length?items.map(n=><article key={n.idNotificacion} className={`lunaria-notification-item ${n.leida?'is-read':''}`}>
    <button className="lunaria-notification-delete" type="button" aria-label={`Eliminar notificación: ${n.titulo}`} title="Eliminar notificación" onClick={()=>eliminar(n.idNotificacion)}><Trash2 size={13}/></button>
    <strong>{n.titulo}</strong>
    <p>{n.mensaje}</p>
    <div className="lunaria-notification-meta"><small>{new Date(n.creadaEn).toLocaleString('es-CO')}</small>{!n.leida&&<button className="lunaria-notification-read" type="button" onClick={()=>leer(n.idNotificacion)}><Check size={12}/> Leída</button>}</div>
   </article>):<p className="lunaria-notifications-empty">No tienes notificaciones nuevas.</p>}
  </div>}
 </div>;
}
