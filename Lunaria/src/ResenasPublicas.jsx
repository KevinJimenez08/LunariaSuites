import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
const API='https://lunariasuites.onrender.com/api';
export default function ResenasPublicas({sesion}){
 const [items,setItems]=useState([]),[calificacion,setCalificacion]=useState(5),[titulo,setTitulo]=useState(''),[comentario,setComentario]=useState(''),[mensaje,setMensaje]=useState(''),[error,setError]=useState('');
 const cargar=async()=>{try{const r=await fetch(`${API}/resenas`);const d=await r.json();if(r.ok)setItems(Array.isArray(d)?d:[]);}catch{}};
 useEffect(()=>{cargar();},[]);
 const enviar=async e=>{e.preventDefault();setError('');setMensaje('');try{const r=await fetch(`${API}/resenas`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${sesion?.token||localStorage.getItem('lunariaToken')||''}`},body:JSON.stringify({calificacion,titulo,comentario})});const d=await r.json();if(!r.ok)throw new Error(d.mensaje||'No se pudo enviar la reseña.');setComentario('');setTitulo('');setMensaje('Tu reseña fue publicada. ¡Gracias por compartir tu experiencia!');await cargar();}catch(e){setError(e.message);}};
 return <section className="lunaria-reviews" id="resenas"><div className="lunaria-section-heading"><div><span className="lunaria-eyebrow">VOCES LUNARIA</span><h2>Reseñas de nuestros huéspedes</h2><p>Experiencias compartidas por quienes ya nos visitaron.</p></div></div>
 <div className="lunaria-review-grid">{items.map(x=><article key={x.idResena}><div className="lunaria-review-stars">{'★'.repeat(Number(x.calificacion))}{'☆'.repeat(5-Number(x.calificacion))}</div><h3>{x.titulo||'Una experiencia Lunaria'}</h3><p>{x.comentario}</p><small>{x.cliente} · {new Date(x.fechaCreacion).toLocaleDateString('es-CO')}</small></article>)}{!items.length&&<p>Aún no hay reseñas publicadas.</p>}</div>
 {sesion?.usuario?.idClientesFK&&<form className="lunaria-review-form" onSubmit={enviar}><h3>Comparte tu experiencia</h3><label>Calificación<select value={calificacion} onChange={e=>setCalificacion(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} estrellas</option>)}</select></label><label>Título<input value={titulo} onChange={e=>setTitulo(e.target.value)} maxLength={120} placeholder="Resume tu experiencia"/></label><label>Tu reseña<textarea value={comentario} onChange={e=>setComentario(e.target.value)} maxLength={2000} required rows={4}/></label><button type="submit" disabled={!comentario.trim()}>Publicar reseña</button>{mensaje&&<p role="status">{mensaje}</p>}{error&&<p role="alert">{error}</p>}</form>}
 </section>;
}
