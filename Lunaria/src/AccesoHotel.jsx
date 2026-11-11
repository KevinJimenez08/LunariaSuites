import { useState } from 'react';
import { ArrowLeft, LockKeyhole, Mail, UserRound, Phone, MoonStar } from 'lucide-react';
import './AccesoHotel.css';
const API = 'http://localhost:3000/api/auth';

export default function AccesoHotel({ modo, cambiarModo, volver, alEntrar, mensaje = '' }) {
  const [form, setForm] = useState({ Nombre: '', Email: '', Telefono: '', contraseña: '' });
  const [error, setError] = useState(mensaje);
  const [cargando, setCargando] = useState(false);
  const [recuperar, setRecuperar] = useState(false);
  const [paso, setPaso] = useState(1);
  const [codigo, setCodigo] = useState('');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [mostrarTerminos, setMostrarTerminos] = useState(false);
  const registro = modo === 'registro';
  const actualizar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function enviar(e) {
    e.preventDefault(); setError(''); setCargando(true);
    try {
      const response = await fetch(`${API}/${registro ? 'registro' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registro ? { ...form, aceptaTerminos } : form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.mensaje || 'No fue posible completar el acceso.');
      alEntrar(data);
    } catch (err) {
      setError(err.message || 'No se pudo conectar con el servidor. Verifica que el backend esté iniciado.');
    } finally { setCargando(false); }
  }

  async function enviarCodigo(e) {
    e.preventDefault(); setError(''); setCargando(true);
    try { const r=await fetch(`${API}/recuperar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({Email:form.Email})}); const d=await r.json(); if(!r.ok)throw new Error(d.mensaje||'No se pudo enviar el código.'); setError(d.mensaje); setPaso(2); }
    catch(err){setError(err.message);} finally{setCargando(false);}
  }
  async function guardarNueva(e) {
    e.preventDefault(); setError(''); setCargando(true);
    try { const r=await fetch(`${API}/restablecer`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({Email:form.Email,codigo,nuevaContrasena})}); const d=await r.json(); if(!r.ok)throw new Error(d.mensaje||'No se pudo cambiar la contraseña.'); setError(d.mensaje); setRecuperar(false); setPaso(1); setCodigo(''); setNuevaContrasena(''); }
    catch(err){setError(err.message);} finally{setCargando(false);}
  }

  return <main className="luna-auth-page">
    <button className="luna-auth-back" onClick={volver}><ArrowLeft size={17}/> Volver al hotel</button>
    <section className="luna-auth-card">
      <img className="luna-auth-logo" src="/img/Logo.jpg" alt="Logo de Hotel Lunaria" onError={e => { e.currentTarget.style.display = 'none'; }}/>
      <div className="luna-auth-brand"><MoonStar size={18}/><span>HOTEL LUNARIA</span></div>
      <h1>{registro ? 'Crea tu cuenta' : 'Qué bueno tenerte de vuelta'}</h1>
      <p className="luna-auth-intro">{registro ? 'Regístrate para preparar tu próxima experiencia.' : 'Ingresa para continuar con tu experiencia Lunaria.'}</p>
      {recuperar ? <form onSubmit={paso===1?enviarCodigo:guardarNueva}>
        <label><span><Mail size={16}/> Correo electrónico</span><input type="email" value={form.Email} onChange={e=>setForm({...form,Email:e.target.value})} required placeholder="correo@ejemplo.com"/></label>
        {paso===2 && <>
          <label><span><LockKeyhole size={16}/> Código de 6 dígitos</span><input inputMode="numeric" maxLength={6} value={codigo} onChange={e=>setCodigo(e.target.value.replace(/\D/g,'').slice(0,6))} required placeholder="000000"/></label>
          <label><span><LockKeyhole size={16}/> Nueva contraseña</span><input type="password" minLength={8} value={nuevaContrasena} onChange={e=>setNuevaContrasena(e.target.value)} required placeholder="Mínimo 8 caracteres"/></label>
        </>}
        {error && <p className="luna-auth-error" role="alert">{error}</p>}
        <button className="luna-auth-submit" type="submit" disabled={cargando}>{cargando?'Procesando…':paso===1?'Enviar código':'Restablecer contraseña'}</button>
        <p className="luna-auth-switch"><button type="button" onClick={()=>{setRecuperar(false);setPaso(1);setError('');}}>Volver al inicio de sesión</button></p>
      </form> : <form onSubmit={enviar}>
        {registro && <label><span><UserRound size={16}/> Nombre completo</span><input name="Nombre" value={form.Nombre} onChange={actualizar} autoComplete="name" required maxLength={100} placeholder="Tu nombre"/></label>}
        <label><span><Mail size={16}/> Correo electrónico</span><input type="email" name="Email" value={form.Email} onChange={actualizar} autoComplete="email" required placeholder="correo@ejemplo.com"/></label>
        {registro && <label><span><Phone size={16}/> Teléfono</span><input name="Telefono" value={form.Telefono} onChange={actualizar} autoComplete="tel" required placeholder="Tu teléfono"/></label>}
        <label><span><LockKeyhole size={16}/> Contraseña</span><input type="password" name="contraseña" value={form.contraseña} onChange={actualizar} autoComplete={registro ? 'new-password' : 'current-password'} minLength={8} required placeholder="Mínimo 8 caracteres"/></label>
        {registro && <div className="luna-terms-accept"><label><input type="checkbox" checked={aceptaTerminos} onChange={e=>setAceptaTerminos(e.target.checked)} required/><span>Acepto los <button type="button" onClick={()=>setMostrarTerminos(true)}>términos y condiciones de Hotel Lunaria</button>.</span></label></div>}
        {error && <p className="luna-auth-error" role="alert">{error}</p>}
        <button className="luna-auth-submit" type="submit" disabled={cargando || (registro && !aceptaTerminos)}>{cargando ? 'Procesando…' : registro ? 'Crear cuenta' : 'Iniciar sesión'}</button>
      </form>}
      {mostrarTerminos && <div className="luna-terms-overlay" role="dialog" aria-modal="true" aria-labelledby="luna-terms-title"><section className="luna-terms-modal"><button type="button" className="luna-terms-close" onClick={()=>setMostrarTerminos(false)}>×</button><h2 id="luna-terms-title">Términos y condiciones de Hotel Lunaria</h2><div className="luna-terms-content">
        <h3>1. Aceptación</h3><p>Al crear una cuenta, navegar o solicitar una reserva en Hotel Lunaria, el usuario declara que ha leído y acepta estas condiciones.</p>
        <h3>2. Registro y veracidad</h3><p>El usuario debe suministrar información veraz, completa y actualizada. Es responsable de mantener la confidencialidad de sus credenciales y de las actividades realizadas desde su cuenta.</p>
        <h3>3. Reservas y disponibilidad</h3><p>Las solicitudes están sujetas a disponibilidad y confirmación por parte del hotel. La reserva se considera confirmada únicamente cuando Hotel Lunaria comunique su aceptación. Los precios, fechas, sede, ocupación y servicios seleccionados se detallarán antes de enviar la solicitud.</p>
        <h3>4. Tarifas y pagos</h3><p>El valor final depende de las fechas, número de huéspedes, habitaciones, paquete y servicios adicionales. Los pagos por transferencia o tarjeta pueden quedar pendientes de verificación. Cualquier cargo adicional será informado en el resumen de la reserva.</p>
        <h3>5. Cancelaciones y modificaciones</h3><p>Las solicitudes de cambio o cancelación deben realizarse por los canales oficiales de atención. Su aprobación y los posibles cargos dependerán de las condiciones informadas al momento de confirmar la reserva y de la normativa colombiana aplicable.</p>
        <h3>6. Uso de las instalaciones</h3><p>El huésped se compromete a respetar las normas de convivencia, cuidar las instalaciones, cumplir los horarios de llegada y salida y responder por daños atribuibles a su conducta o la de sus acompañantes.</p>
        <h3>7. Datos personales</h3><p>Los datos suministrados se utilizarán para gestionar la cuenta, atender solicitudes, administrar reservas y prestar los servicios contratados, de acuerdo con la Ley 1581 de 2012 y las políticas de tratamiento de datos personales aplicables. El usuario podrá ejercer sus derechos mediante los canales de contacto oficiales de Hotel Lunaria.</p>
        <h3>8. Comunicaciones y soporte</h3><p>Hotel Lunaria podrá contactar al usuario por los datos registrados para enviar información relacionada con sus solicitudes, reservas y atención al cliente. Los mensajes publicados en el canal de comentarios deben ser respetuosos y no contener información de terceros sin autorización.</p>
        <h3>9. Cambios en las condiciones</h3><p>Estas condiciones podrán actualizarse para reflejar cambios operativos o normativos. La versión vigente estará disponible en el proceso de registro.</p>
        <h3>10. Contacto y legislación</h3><p>Estas condiciones se rigen por las leyes de la República de Colombia. Para dudas, reclamos o solicitudes, el usuario podrá comunicarse mediante los canales oficiales publicados por Hotel Lunaria.</p>
        <p><strong>Última actualización: 9 de noviembre de 2026.</strong></p>
      </div><button type="button" className="luna-auth-submit" onClick={()=>setMostrarTerminos(false)}>Cerrar y continuar</button></section></div>}
      {!registro && !recuperar && <p className="luna-auth-switch"><button type="button" onClick={()=>{setRecuperar(true);setError('');}}>¿Olvidaste tu contraseña?</button></p>}
      <p className="luna-auth-switch">{registro ? '¿Ya tienes una cuenta?' : '¿Primera vez en Lunaria?'} <button onClick={() => { cambiarModo(registro ? 'login' : 'registro'); setError(''); }}>{registro ? 'Inicia sesión' : 'Regístrate'}</button></p>
    </section>
  </main>;
}
