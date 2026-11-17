import {useState} from 'react';
import {MessageCircle} from 'lucide-react';
import GestionComentarios from './GestionComentarios.jsx';
import './ClienteHotel.css';
const normalizar = v => String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const esPersonalChat = u => ['gerente','superadmin','administrador','admin','soporte','soportetecnico','personaldeapoyo'].includes(normalizar(u?.Rol));
export default function ChatBubble({sesion}){
 const [abierto,setAbierto]=useState(false);
 const usuario=sesion?.usuario;
 const personal=esPersonalChat(usuario);
 if(!usuario || (!personal && !usuario.idClientesFK)) return null;
 return <><button className="lunaria-chat-bubble" type="button" aria-label="Abrir chat de soporte" aria-expanded={abierto} onClick={()=>setAbierto(v=>!v)}>{abierto?<span className="lunaria-chat-close">×</span>:<><MessageCircle size={22}/><span>Soporte</span></>}</button>{abierto&&<div className="lunaria-chat-popover"><GestionComentarios sesion={sesion} clienteOnly={!personal} compact/></div>}</>;
}
