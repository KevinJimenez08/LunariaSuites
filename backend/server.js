require('dotenv').config({
    path: require('path').join(__dirname, '.env')
});
const express = require('express');
const cors = require('cors');
const db = require('./db.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('Configura JWT_SECRET en el entorno de producción.'); })() : 'lunaria-local-secret-cambiar-en-produccion');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '12mb' }));
const carpetaComprobantes = path.join(__dirname, 'uploads', 'comprobantes');
fs.mkdirSync(carpetaComprobantes, { recursive: true });

// Log en consola para monitorear las peticiones de React
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} -> ${req.url}`);
  next();
});

// Prueba de conexión
app.get('/api/test', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS resultado');
    res.json({ mensaje: '¡Conexión exitosa con MySQL!' });
  } catch (error) {
    console.error('Error al conectar con la BD:', error);
    res.status(500).json({ mensaje: 'Error de conexión con MySQL' });
  }
});



// Recuperación: token numérico criptográfico, hash único en BD y expiración de 2 minutos.
const hashCodigoRecuperacion = codigo => crypto.createHash('sha256').update(String(codigo)).digest('hex');
const crearTransportadorCorreo = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE||'false')==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
};

// PDF sencillo generado en servidor para adjuntar el comprobante de la reserva al correo.
function crearPdfReserva(datos) {
  const normalizar = (v) => String(v ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ');
  const escapar = (v) => normalizar(v)
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const fechaEmision = datos.fechaEmision || new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const filas = [
    { tipo: 'titulo', texto: 'HOTEL LUNARIA' },
    { tipo: 'subtitulo', texto: 'COMPROBANTE DE RESERVA' },
    { tipo: 'estado', texto: `PAGO: ${datos.estadoPago || 'Pendiente de pago'}` },
    { tipo: 'normal', texto: `Estado de reserva: ${datos.estado || 'Pendiente'}` },
    { tipo: 'cliente', texto: `Cliente: ${datos.nombre || 'No especificado'}` },
    { tipo: 'linea' },
    { tipo: 'seccion', texto: 'DATOS DEL PAGO' },
    { tipo: 'normal', texto: `Fecha de emision: ${fechaEmision}` },
    { tipo: 'normal', texto: `Fecha del pago: ${datos.fechaPago || 'Pendiente / no registrado'}` },
    { tipo: 'normal', texto: `Metodo de pago: ${datos.metodoPago || 'No especificado'}` },
    { tipo: 'linea' },
    { tipo: 'seccion', texto: 'RESERVA' },
    { tipo: 'normal', texto: `Habitacion: ${datos.habitaciones || 'Por asignar'}` },
    { tipo: 'normal', texto: `Codigo de reserva: ${datos.codigo || 'Pendiente'}` },
    { tipo: 'normal', texto: `Entrada: ${datos.fechaInicio || ''} - ${datos.horaLlegada || '15:00'}` },
    { tipo: 'normal', texto: `Salida: ${datos.fechaFin || ''} - ${datos.horaSalida || '12:00'}` },
    { tipo: 'normal', texto: `Sede: ${datos.sede || 'Sede principal'}` },
    { tipo: 'normal', texto: `Paquete: ${datos.paquete || 'No aplica'}` },
    ...(Array.isArray(datos.servicios) && datos.servicios.length ? [
      { tipo: 'linea' },
      { tipo: 'seccion', texto: 'SERVICIOS ADICIONALES' },
      ...datos.servicios.map(servicio => ({
        tipo: 'normal',
        texto: `${servicio.nombre}: ${Number(servicio.precio || 0).toLocaleString('es-CO')} COP`
      }))
    ] : [{ tipo: 'normal', texto: 'Servicios adicionales: Ninguno' }]),
    { tipo: 'total', texto: `TOTAL: ${Number(datos.total || 0).toLocaleString('es-CO')} COP` },
    { tipo: 'nota', texto: 'Conserve este comprobante como referencia de su reserva.' }
  ];
  const ops = [];
  let y = 790;
  const ancho = 495;
  const escribir = (texto, size, bold=false, align='left') => {
    const safe = escapar(texto);
    const estimado = normalizar(texto).length * size * 0.52;
    const x = align === 'center' ? Math.max(50, (595-estimado)/2) : 50;
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${safe}) Tj ET`);
    y -= size + 9;
  };
  for (const fila of filas) {
    if (fila.tipo === 'linea') {
      y -= 3; ops.push(`0.75 w 50 ${y} m 545 ${y} l S`); y -= 18; continue;
    }
    if (fila.tipo === 'titulo') { escribir(fila.texto, 23, true, 'center'); y -= 1; continue; }
    if (fila.tipo === 'subtitulo') { escribir(fila.texto, 12, true, 'center'); y -= 5; continue; }
    if (fila.tipo === 'estado') { escribir(fila.texto, 13, true, 'center'); y -= 2; continue; }
    if (fila.tipo === 'cliente') { escribir(fila.texto, 12, true); continue; }
    if (fila.tipo === 'seccion') { escribir(fila.texto, 12, true); continue; }
    if (fila.tipo === 'total') { escribir(fila.texto, 14, true); continue; }
    if (fila.tipo === 'nota') { y -= 8; escribir(fila.texto, 9, false); continue; }
    const texto = normalizar(fila.texto);
    const partes = [];
    for (let resto = texto; resto.length > 92; resto = resto.slice(92)) partes.push(resto.slice(0,92));
    partes.push(texto.slice(partes.reduce((n,x)=>n+x.length,0)));
    partes.forEach(parte => escribir(parte, 10, false));
  }
  const contenido = ops.join('\n');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(contenido, 'ascii')} >>\nstream\n${contenido}\nendstream`
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objetos.forEach((obj, i) => { offsets.push(Buffer.byteLength(pdf, 'ascii')); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}

function leerComprobanteBase64(comprobante) {
  if (!comprobante) return null;
  const match = String(comprobante.data || '').match(/^data:(application\/pdf|image\/png|image\/jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('El comprobante debe ser PDF, PNG o JPG válido.');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 8 * 1024 * 1024) throw new Error('El comprobante no puede superar 8 MB.');
  return { buffer, mimetype: match[1], filename: String(comprobante.name || 'comprobante').replace(/[^a-zA-Z0-9._-]/g, '_') };
}

console.log('Configuración de correo:', {
  host: process.env.SMTP_HOST,
  usuarioConfigurado: Boolean(process.env.SMTP_USER),
  contraseñaConfigurada: Boolean(process.env.SMTP_PASS)
});
app.post('/api/auth/recuperar', async (req,res) => {
  const email=String(req.body?.Email||'').trim().toLowerCase();
  if(!email) return res.status(400).json({mensaje:'Ingresa tu correo electrónico.'});
  try {
    const [usuarios]=await db.query('SELECT idUsuarios,Email FROM usuarios WHERE LOWER(Email)=? AND Estado=1 LIMIT 1',[email]);
    if(!usuarios.length) return res.json({mensaje:'Si el correo está registrado, recibirás un código.'});
    const mailer=crearTransportadorCorreo();
    if(!mailer) return res.status(503).json({mensaje:'Configura SMTP_HOST, SMTP_USER y SMTP_PASS en backend/.env.'});
    let codigo,hash,unico=false;
    for(let i=0;i<40;i++){
      codigo=String(crypto.randomInt(0,1000000)).padStart(6,'0'); hash=hashCodigoRecuperacion(codigo);
      const [existente]=await db.query('SELECT id FROM recuperacion_contrasenas WHERE codigoHash=? AND usado=0 AND expiraEn>NOW() LIMIT 1',[hash]);
      if(!existente.length){unico=true;break;}
    }
    if(!unico) throw new Error('No se pudo generar un código único. Intenta nuevamente.');
    await db.query('UPDATE recuperacion_contrasenas SET usado=1 WHERE idUsuariosFK=? AND usado=0',[usuarios[0].idUsuarios]);
    await db.query('INSERT INTO recuperacion_contrasenas (idUsuariosFK,codigoHash,expiraEn) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 2 MINUTE))',[usuarios[0].idUsuarios,hash]);
    await mailer.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:usuarios[0].Email,subject:'Recuperación de contraseña - Hotel Lunaria',text:`Tu código es ${codigo}. Caduca en 2 minutos.`});
    res.json({mensaje:'Te enviamos un código de 6 dígitos a tu correo.'});
  } catch(e){console.error('Recuperación:',e);res.status(500).json({mensaje:'No se pudo enviar el código.'});}
});
app.post('/api/auth/restablecer', async(req,res)=>{
  const email=String(req.body?.Email||'').trim().toLowerCase(),codigo=String(req.body?.codigo||''),nueva=String(req.body?.nuevaContrasena||'');
  if(!email||!/^[0-9]{6}$/.test(codigo)||nueva.length<6)return res.status(400).json({mensaje:'Verifica correo, código y contraseña (mínimo 6 caracteres).'});
  const connection=await db.getConnection();
  try{
    await connection.beginTransaction();
    const hash=hashCodigoRecuperacion(codigo);
    const [rows]=await connection.query(`SELECT r.id,r.idUsuariosFK FROM recuperacion_contrasenas r INNER JOIN usuarios u ON u.idUsuarios=r.idUsuariosFK WHERE LOWER(u.Email)=? AND r.codigoHash=? AND r.usado=0 AND r.expiraEn>NOW() LIMIT 1 FOR UPDATE`,[email,hash]);
    if(!rows.length)throw new Error('El código es incorrecto o caducó. Solicita uno nuevo.');
    const pass=await bcrypt.hash(nueva,10);
    await connection.query('UPDATE usuarios SET contraseña=? WHERE idUsuarios=?',[pass,rows[0].idUsuariosFK]);
    await connection.query('UPDATE recuperacion_contrasenas SET usado=1 WHERE id=?',[rows[0].id]);
    await connection.commit();
    let correoAvisoEnviado = false;
    try {
      const [[usuarioAviso]] = await db.query('SELECT Nombre,Email FROM usuarios WHERE idUsuarios=? LIMIT 1',[rows[0].idUsuariosFK]);
      const mailAviso = crearTransportadorCorreo();
      if (mailAviso && usuarioAviso?.Email) {
        await mailAviso.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: usuarioAviso.Email,
          subject: 'Hotel Lunaria: contraseña restablecida',
          text: `Hola ${usuarioAviso.Nombre || ''},\nLa contraseña de tu cuenta fue restablecida el ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}. Si no solicitaste este cambio, comunícate con el hotel.`
        });
        correoAvisoEnviado = true;
      }
    } catch (mailError) { console.error('No se pudo notificar el restablecimiento:', mailError); }
    res.json({mensaje:'Contraseña actualizada. Ya puedes iniciar sesión.', correoAvisoEnviado});
  }catch(e){await connection.rollback();res.status(400).json({mensaje:e.message});}finally{connection.release();}
});

// ==========================================
// AUTENTICACIÓN PÚBLICA Y REGISTRO DE CLIENTES
// ==========================================
app.post('/api/auth/registro', async (req, res) => {
  const { Nombre, Email, Telefono, contraseña, aceptaTerminos } = req.body || {};
  if (aceptaTerminos !== true) return res.status(400).json({ mensaje: 'Debes aceptar los términos y condiciones para crear tu cuenta.' });
  if (!Nombre?.trim() || !Email?.trim() || !Telefono?.trim() || !contraseña || String(contraseña).length < 6) {
    return res.status(400).json({ mensaje: 'Completa nombre, correo, teléfono y una contraseña de al menos 6 caracteres.' });
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [existentes] = await connection.query('SELECT idUsuarios FROM usuarios WHERE Email = ? LIMIT 1', [Email.trim()]);
    if (existentes.length) { await connection.rollback(); return res.status(409).json({ mensaje: 'Ya existe una cuenta con ese correo.' }); }
    const [roles] = await connection.query("SELECT idRoles FROM roles WHERE LOWER(nomRol) = 'cliente' AND Estado = 1 LIMIT 1");
    if (!roles.length) { await connection.rollback(); return res.status(500).json({ mensaje: 'No existe un rol Cliente activo en la tabla roles.' }); }
    const [cliente] = await connection.query('INSERT INTO clientes (Nombre, Email, Telefono, Estado) VALUES (?, ?, ?, 1)', [Nombre.trim(), Email.trim(), Telefono.trim()]);
    const hash = await bcrypt.hash(String(contraseña), 10);
    const [usuario] = await connection.query('INSERT INTO usuarios (Nombre, Email, Telefono, contraseña, idRolesFK, idClientesFK, Estado, aceptaTerminos, fechaAceptacionTerminos) VALUES (?, ?, ?, ?, ?, ?, 1, 1, NOW())', [Nombre.trim(), Email.trim(), Telefono.trim(), hash, roles[0].idRoles, cliente.insertId]);
    await connection.commit();
    let correoRegistroEnviado = false;
    const mailRegistro = crearTransportadorCorreo();
    if (mailRegistro) {
      try {
        await mailRegistro.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: Email.trim(),
          subject: 'Bienvenido a Hotel Lunaria',
          text: `Hola ${Nombre.trim()},\nTu cuenta de Hotel Lunaria fue creada correctamente el ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}. Ya puedes iniciar sesión y reservar tu estadía.`
        });
        correoRegistroEnviado = true;
      } catch (mailError) { console.error('No se pudo enviar el correo de registro:', mailError); }
    }
    const payload = { idUsuarios: usuario.insertId, Nombre: Nombre.trim(), Email: Email.trim(), Telefono: Telefono.trim(), idRolesFK: roles[0].idRoles, idClientesFK: cliente.insertId, Rol: 'Cliente', Permisos: '' };
    const token = jwt.sign({ idUsuarios: payload.idUsuarios, idRolesFK: payload.idRolesFK, idClientesFK: payload.idClientesFK, Email: payload.Email, Rol: payload.Rol }, JWT_SECRET, { expiresIn: '8h' });
    return res.status(201).json({ mensaje: 'Cuenta creada correctamente.', token, usuario: payload, correoRegistroEnviado });
  } catch (error) {
    await connection.rollback();
    console.error('Error en registro:', error);
    return res.status(500).json({ mensaje: 'No se pudo crear la cuenta. Verifica la conexión y las tablas de MySQL.' });
  } finally { connection.release(); }
});

app.post('/api/auth/login', async (req, res) => {
  const { Email, contraseña } = req.body || {};
  if (!Email?.trim() || !contraseña) return res.status(400).json({ mensaje: 'Escribe tu correo y contraseña.' });
  try {
    const [rows] = await db.query(`SELECT u.idUsuarios, u.Nombre, u.Email, u.Telefono, u.contraseña, u.idRolesFK, u.idClientesFK, u.Estado, u.fechaDesactivacion, r.nomRol AS Rol, r.Permisos
      FROM usuarios u LEFT JOIN roles r ON r.idRoles = u.idRolesFK WHERE u.Email = ? LIMIT 1`, [Email.trim()]);
    if (!rows.length) return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
    const u = rows[0];
    let valida = false;
    if (String(u.contraseña).startsWith('$2')) valida = await bcrypt.compare(String(contraseña), u.contraseña);
    else {
      // Compatibilidad con cuentas antiguas guardadas como texto; al entrar se actualizan a hash.
      valida = String(contraseña) === String(u.contraseña);
      if (valida) await db.query('UPDATE usuarios SET contraseña = ? WHERE idUsuarios = ?', [await bcrypt.hash(String(contraseña), 10), u.idUsuarios]);
    }
    if (!valida) return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
    if (Number(u.Estado) !== 1) {
      if (!u.fechaDesactivacion) return res.status(401).json({ mensaje: 'Esta cuenta está inactiva. Comunícate con el hotel.' });
      const diasInactiva = (Date.now() - new Date(u.fechaDesactivacion).getTime()) / 86400000;
      if (diasInactiva > 90) return res.status(403).json({ mensaje: 'El plazo de reactivación de 90 días terminó. La cuenta ya fue cerrada.' });
      await db.query('UPDATE usuarios SET Estado=1, fechaDesactivacion=NULL WHERE idUsuarios=?', [u.idUsuarios]);
      if (u.idClientesFK) await db.query('UPDATE clientes SET Estado=1 WHERE idClientes=?', [u.idClientesFK]);
    }
    const usuario = { idUsuarios: u.idUsuarios, Nombre: u.Nombre, Email: u.Email, Telefono: u.Telefono, idRolesFK: u.idRolesFK, idClientesFK: u.idClientesFK, Rol: u.Rol || 'Sin rol', Permisos: u.Permisos || '' };
    const token = jwt.sign({ idUsuarios: u.idUsuarios, idRolesFK: u.idRolesFK, idClientesFK: u.idClientesFK, Email: u.Email, Rol: usuario.Rol }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ mensaje: 'Inicio de sesión correcto.', token, usuario });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: 'No se pudo iniciar sesión. Verifica la conexión con MySQL.' });
  }
});

function exigirToken(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
  if (!token) return res.status(401).json({ mensaje: 'Debes iniciar sesión para realizar esta operación.' });
  try { req.sesion = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ mensaje: 'Sesión vencida o token no válido. Inicia sesión nuevamente.' }); }
}

// El cliente puede suspender su cuenta durante un máximo de 90 días.
app.post('/api/auth/desactivar-cuenta', exigirToken, async (req, res) => {
  if (Number(req.sesion.idRolesFK) !== 4) return res.status(403).json({ mensaje: 'Esta opción está disponible únicamente para cuentas de cliente.' });
  const contrasena = String(req.body?.contrasena || '');
  if (!contrasena) return res.status(400).json({ mensaje: 'Confirma tu contraseña para desactivar la cuenta.' });
  try {
    const [[u]] = await db.query('SELECT idUsuarios, idClientesFK, contraseña, Estado FROM usuarios WHERE idUsuarios=? LIMIT 1', [req.sesion.idUsuarios]);
    if (!u || Number(u.Estado) !== 1) return res.status(400).json({ mensaje: 'La cuenta no está activa.' });
    const coincide = String(u.contraseña || '').startsWith('$2') ? await bcrypt.compare(contrasena, u.contraseña) : contrasena === String(u.contraseña);
    if (!coincide) return res.status(400).json({ mensaje: 'La contraseña es incorrecta.' });
    await db.query('UPDATE usuarios SET Estado=0, fechaDesactivacion=NOW() WHERE idUsuarios=?', [u.idUsuarios]);
    if (u.idClientesFK) await db.query('UPDATE clientes SET Estado=0 WHERE idClientes=?', [u.idClientesFK]);
    return res.json({ mensaje: 'Cuenta desactivada. Puedes reactivarla iniciando sesión antes de que pasen 90 días.' });
  } catch (error) { console.error('Error al desactivar cuenta:', error); return res.status(500).json({ mensaje: 'No se pudo desactivar la cuenta.' }); }
});

// La eliminación anonimiza los datos personales y conserva las reservas y facturas históricas.
app.delete('/api/auth/cuenta', exigirToken, async (req, res) => {
  if (Number(req.sesion.idRolesFK) !== 4) return res.status(403).json({ mensaje: 'Esta opción está disponible únicamente para cuentas de cliente.' });
  const contrasena = String(req.body?.contrasena || '');
  if (!contrasena) return res.status(400).json({ mensaje: 'Confirma tu contraseña para eliminar la cuenta.' });
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[u]] = await connection.query('SELECT idUsuarios, idClientesFK, Nombre, contraseña FROM usuarios WHERE idUsuarios=? FOR UPDATE', [req.sesion.idUsuarios]);
    if (!u) { await connection.rollback(); return res.status(404).json({ mensaje: 'No se encontró la cuenta.' }); }
    const coincide = String(u.contraseña || '').startsWith('$2') ? await bcrypt.compare(contrasena, u.contraseña) : contrasena === String(u.contraseña);
    if (!coincide) { await connection.rollback(); return res.status(400).json({ mensaje: 'La contraseña es incorrecta.' }); }
    const correoAnonimo = `cuenta.eliminada.${u.idUsuarios}@lunaria.invalid`;
    await connection.query("UPDATE usuarios SET Nombre='Cuenta eliminada', Email=?, Telefono=NULL, contraseña=?, Estado=0, fechaDesactivacion=NOW() WHERE idUsuarios=?", [correoAnonimo, crypto.randomBytes(32).toString('hex'), u.idUsuarios]);
    if (u.idClientesFK) await connection.query("UPDATE clientes SET Nombre='Cuenta eliminada', Email=?, Telefono=NULL, Estado=0 WHERE idClientes=?", [correoAnonimo, u.idClientesFK]);
    await connection.commit();
    return res.json({ mensaje: 'Tu cuenta fue eliminada y tus datos personales fueron anonimizados. El historial de reservas se conserva por motivos administrativos.' });
  } catch (error) { await connection.rollback(); console.error('Error al eliminar cuenta:', error); return res.status(500).json({ mensaje: 'No se pudo eliminar la cuenta.' }); }
  finally { connection.release(); }
});

// Cierre automático de cuentas suspendidas que superan los 90 días: se anonimizan,
// sin borrar reservas ni movimientos contables relacionados.
async function cerrarCuentasVencidas() {
  try {
    const [vencidas] = await db.query("SELECT idUsuarios, idClientesFK FROM usuarios WHERE Estado=0 AND fechaDesactivacion IS NOT NULL AND fechaDesactivacion <= DATE_SUB(NOW(), INTERVAL 90 DAY)");
    for (const u of vencidas) {
      const correo = `cuenta.cerrada.${u.idUsuarios}@lunaria.invalid`;
      await db.query("UPDATE usuarios SET Nombre='Cuenta cerrada', Email=?, Telefono=NULL, contraseña=?, fechaDesactivacion=NULL WHERE idUsuarios=?", [correo, crypto.randomBytes(32).toString('hex'), u.idUsuarios]);
      if (u.idClientesFK) await db.query("UPDATE clientes SET Nombre='Cuenta cerrada', Email=?, Telefono=NULL, Estado=0 WHERE idClientes=?", [correo, u.idClientesFK]);
    }
  } catch (error) { console.error('No se pudieron cerrar cuentas vencidas:', error.message); }
}
setTimeout(() => { cerrarCuentasVencidas(); setInterval(cerrarCuentasVencidas, 24 * 60 * 60 * 1000); }, 5000);


app.post('/api/auth/cambiar-contrasena', exigirToken, async (req, res) => {
  const actual = String(req.body?.contrasenaActual || '');
  const nueva = String(req.body?.nuevaContrasena || '');
  if (!actual || nueva.length < 6) {
    return res.status(400).json({ mensaje: 'Escribe tu contraseña actual y una nueva de al menos 6 caracteres.' });
  }
  try {
    const [usuarios] = await db.query(
      'SELECT idUsuarios, Nombre, Email, contraseña FROM usuarios WHERE idUsuarios=? AND Estado=1 LIMIT 1',
      [req.sesion.idUsuarios]
    );
    if (!usuarios.length) return res.status(404).json({ mensaje: 'No se encontró la cuenta activa.' });
    const usuario = usuarios[0];
    const esHash = String(usuario.contraseña || '').startsWith('$2');
    const coincide = esHash
      ? await bcrypt.compare(actual, usuario.contraseña)
      : actual === String(usuario.contraseña);
    if (!coincide) return res.status(400).json({ mensaje: 'La contraseña actual es incorrecta.' });
    if (actual === nueva) return res.status(400).json({ mensaje: 'La nueva contraseña debe ser diferente a la actual.' });
    await db.query('UPDATE usuarios SET contraseña=? WHERE idUsuarios=?', [await bcrypt.hash(nueva, 10), usuario.idUsuarios]);
    let emailEnviado = false;
    const mailer = crearTransportadorCorreo();
    if (mailer && usuario.Email) {
      try {
        await mailer.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: usuario.Email,
          subject: 'Hotel Lunaria: cambio de contraseña',
          text: `Hola ${usuario.Nombre || ''},\nLa contraseña de tu cuenta de Hotel Lunaria fue cambiada correctamente el ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}. Si no realizaste este cambio, comunícate con el hotel inmediatamente.`
        });
        emailEnviado = true;
      } catch (mailError) { console.error('No se pudo notificar el cambio de contraseña:', mailError); }
    }
    return res.json({ mensaje: 'Contraseña actualizada correctamente.', emailEnviado });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    return res.status(500).json({ mensaje: 'No se pudo actualizar la contraseña.' });
  }
});

const normalizarPermiso = (valor = '') => String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function permisosParseados(valor) {
  if (Array.isArray(valor)) return valor.map(normalizarPermiso);
  if (valor && typeof valor === 'object') return Object.entries(valor).filter(([, v]) => v === true || v === 1 || v === '1').map(([k]) => normalizarPermiso(k));
  const texto = String(valor || '').trim();
  if (!texto) return [];
  try {
    const parsed = JSON.parse(texto);
    if (Array.isArray(parsed) || (parsed && typeof parsed === 'object')) return permisosParseados(parsed);
  } catch { /* Los permisos también pueden estar separados por comas o punto y coma. */ }
  return texto.split(/[,;|\n]/).map(normalizarPermiso).filter(Boolean);
}
function exigirModulo(modulo) {
  const alias = {
    roles: ['roles', 'gestionroles', 'gestionderoles', 'administracionderoles'], usuarios: ['usuarios', 'gestionusuarios', 'gestiondeusuarios'],
    habitaciones: ['habitaciones', 'gestionhabitaciones', 'gestiondehabitaciones'], servicios: ['servicios', 'gestionservicios', 'gestiondeservicios'],
    paquetes: ['paquetes', 'gestionpaquetes', 'gestiondepaquetes'], clientes: ['clientes', 'gestionclientes', 'gestiondeclientes'],
    reservas: ['reservas', 'gestionreservas', 'gestiondereservas'], huespedes: ['huespedes', 'huesped', 'gestionhuespedes', 'gestiondehuespedes'],
    proveedores: ['proveedores', 'gestionproveedores']
  };
  return async (req, res, next) => {
    try {
      const [rows] = await db.query('SELECT nomRol, Permisos, Estado FROM roles WHERE idRoles = ? LIMIT 1', [req.sesion?.idRolesFK]);
      if (!rows.length || Number(rows[0].Estado) !== 1) return res.status(403).json({ mensaje: 'El rol de esta cuenta está inactivo o no existe.' });
      const rol = normalizarPermiso(rows[0].nomRol);
      if (Number(req.sesion?.idRolesFK) === 1 || ['superadmin', 'gerente'].includes(rol)) return next();
      // Administrador tiene acceso a los módulos operativos, nunca al módulo de roles.
      if ((rol === 'administrador' || rol === 'admin') && modulo !== 'roles') return next();
      const permisos = permisosParseados(rows[0].Permisos);
      const permitidos = alias[modulo] || [modulo];
      if (permisos.some(p => p === '*' || p === 'todos' || p === 'todoslosmodulos' || permitidos.includes(p))) return next();
      return res.status(403).json({ mensaje: `Tu rol no tiene permiso para el módulo ${modulo}.` });
    } catch (error) {
      console.error(`Error al comprobar permiso del módulo ${modulo}:`, error);
      return res.status(500).json({ mensaje: 'No fue posible comprobar los permisos de esta cuenta.' });
    }
  };
}
function exigirAlgunoDeModulos(...modulos) {
  const mapa = {
    roles: ['roles', 'gestionroles', 'gestionderoles', 'administracionderoles'], usuarios: ['usuarios', 'gestionusuarios', 'gestiondeusuarios'],
    habitaciones: ['habitaciones', 'gestionhabitaciones', 'gestiondehabitaciones'], servicios: ['servicios', 'gestionservicios', 'gestiondeservicios'],
    paquetes: ['paquetes', 'gestionpaquetes', 'gestiondepaquetes'], clientes: ['clientes', 'gestionclientes', 'gestiondeclientes'],
    reservas: ['reservas', 'gestionreservas', 'gestiondereservas'], huespedes: ['huespedes', 'huesped', 'gestionhuespedes', 'gestiondehuespedes'],
    proveedores: ['proveedores', 'gestionproveedores']
  };
  return async (req, res, next) => {
    try {
      const [rows] = await db.query('SELECT nomRol, Permisos, Estado FROM roles WHERE idRoles = ? LIMIT 1', [req.sesion?.idRolesFK]);
      if (!rows.length || Number(rows[0].Estado) !== 1) return res.status(403).json({ mensaje: 'El rol de esta cuenta está inactivo o no existe.' });
      const rol = normalizarPermiso(rows[0].nomRol);
      if (Number(req.sesion?.idRolesFK) === 1 || ['superadmin', 'gerente'].includes(rol)) return next();
      if (rol === 'administrador' || rol === 'admin') return next();
      const permisos = permisosParseados(rows[0].Permisos);
      const permitidos = modulos.flatMap(m => mapa[m] || [m]);
      if (permisos.some(p => p === '*' || p === 'todos' || p === 'todoslosmodulos' || permitidos.includes(p))) return next();
      return res.status(403).json({ mensaje: `Tu rol no tiene permiso para consultar este recurso.` });
    } catch (error) {
      console.error('Error comprobando permisos alternativos:', error);
      return res.status(500).json({ mensaje: 'No fue posible comprobar los permisos de esta cuenta.' });
    }
  };
}

// El catálogo es público para lectura; las modificaciones se autorizan según los permisos del rol.
for (const [ruta, modulo] of [['/api/habitaciones', 'habitaciones'], ['/api/servicios', 'servicios'], ['/api/paquetes', 'paquetes']]) {
  app.use(ruta, (req, res, next) => {
    if (req.method === 'GET') return next();
    exigirToken(req, res, () => exigirModulo(modulo)(req, res, next));
  });
}
app.use('/api/roles', exigirToken, exigirModulo('roles'));
app.use('/api/usuarios', exigirToken, exigirModulo('usuarios'));
app.use('/api/clientes', exigirToken, async (req, res, next) => {
  if (req.method === 'GET') {
    try {
      const [roles] = await db.query('SELECT nomRol FROM roles WHERE idRoles=? LIMIT 1', [req.sesion.idRolesFK]);
      if (['personaldeapoyo','soportetecnico','soporte'].includes(normalizarPermiso(roles[0]?.nomRol || ''))) return next();
    } catch { /* La comprobación estándar de permisos devuelve el error si falla la consulta. */ }
    return exigirAlgunoDeModulos('clientes', 'reservas', 'huespedes')(req, res, next);
  }
  return exigirModulo('clientes')(req, res, next);
});
app.use('/api/huespedes', exigirToken, exigirModulo('huespedes'));
app.use('/api/proveedores', exigirToken, exigirModulo('proveedores'));
app.use('/api/reservas', exigirToken, (req, res, next) => {
  // La ruta de reserva pública autenticada está reservada a huéspedes; las demás requieren permiso de módulo.
  if (req.method === 'POST' && req.path === '/cliente') {
    db.query('SELECT nomRol, Estado FROM roles WHERE idRoles = ? LIMIT 1', [req.sesion?.idRolesFK]).then(([rows]) => {
      if (!rows.length || Number(rows[0].Estado) !== 1 || normalizarPermiso(rows[0].nomRol) !== 'cliente') return res.status(403).json({ mensaje: 'Para reservar desde la página pública necesitas una cuenta de huésped.' });
      return next();
    }).catch(error => { console.error('Error validando rol de huésped:', error); return res.status(500).json({ mensaje: 'No se pudo validar el rol de la cuenta.' }); });
    return;
  }
  return exigirModulo('reservas')(req, res, next);
});

// ==========================================
// RUTAS DE ROLES
// ==========================================

// Opciones mínimas de roles para los formularios de usuarios. No expone los permisos completos.
app.get('/api/opciones-roles', exigirToken, exigirModulo('usuarios'), async (req, res) => {
  try {
    const [rows] = await db.query("SELECT idRoles, nomRol FROM roles WHERE Estado = 1 ORDER BY nomRol");
    res.json(rows);
  } catch (error) {
    console.error('Error al consultar opciones de roles:', error);
    res.status(500).json({ mensaje: 'No se pudieron cargar los roles disponibles.' });
  }
});

app.get('/api/roles', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT idRoles AS id, nomRol AS nombre, Permisos AS permisos, Estado AS estado FROM roles'
    );
    const rolesFormateados = rows.map((r) => ({
      ...r,
      estado: r.estado === 1 ? 'Activo' : 'Inactivo'
    }));
    res.json(rolesFormateados);
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({ mensaje: 'Error al consultar roles' });
  }
});

app.post('/api/roles', async (req, res) => {
  const { nombre, permisos, estado } = req.body;
  const estadoTiny = estado === 'Activo' ? 1 : 0;
  try {
    const [result] = await db.query(
      'INSERT INTO roles (nomRol, Permisos, Estado) VALUES (?, ?, ?)',
      [nombre, permisos, estadoTiny]
    );
    res.json({ id: result.insertId, nombre, permisos, estado });
  } catch (error) {
    console.error('Error al crear rol:', error);
    res.status(500).json({ mensaje: 'Error al guardar el rol' });
  }
});

app.put('/api/roles/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, permisos, estado } = req.body;
  const estadoTiny = estado === 'Activo' ? 1 : 0;
  const permisosTexto = permisos || 'Sin permisos asignados';

  try {
    const [result] = await db.query(
      'UPDATE roles SET nomRol = ?, Permisos = ?, Estado = ? WHERE idRoles = ?',
      [nombre, permisosTexto, estadoTiny, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'No se encontró el rol para actualizar' });
    }

    res.json({ mensaje: 'Rol actualizado con éxito' });
  } catch (error) {
    console.error('Error al actualizar en MySQL:', error);
    res.status(500).json({ mensaje: 'Error al actualizar el rol', detalle: error.message });
  }
});

app.delete('/api/roles/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM roles WHERE idRoles = ?', [id]);
    res.json({ mensaje: 'Rol eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar rol:', error);
    res.status(500).json({ mensaje: 'Error al eliminar el rol' });
  }
});

// ==========================================
// RUTAS DE USUARIOS
// ==========================================

app.get('/api/usuarios', async (req, res) => {
  try {
    const query = `
      SELECT 
        u.idUsuarios, 
        u.Nombre, 
        u.Email, 
        u.Telefono, 
        u.Estado, 
        u.idRolesFK, 
        u.idClientesFK,
        u.idProveedoresFK,
        COALESCE(r.nomRol, 'Sin Rol') AS Rol
      FROM usuarios u
      LEFT JOIN roles r ON u.idRolesFK = r.idRoles
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ mensaje: 'Error al consultar usuarios' });
  }
});

app.post('/api/usuarios', async (req, res) => {
  const { Nombre, Email, Telefono, contraseña, idRolesFK, idClientesFK, idProveedoresFK, Estado } = req.body;
  const estadoValue = Estado !== undefined ? Estado : 1;

  if (!Nombre || !Email || !contraseña) {
    return res.status(400).json({ mensaje: 'Nombre, Email y Contraseña son obligatorios' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO usuarios (Nombre, Email, Telefono, contraseña, idRolesFK, idClientesFK, idProveedoresFK, Estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [Nombre, Email, Telefono || null, contraseña, idRolesFK || null, idClientesFK || null, idProveedoresFK || null, estadoValue]
    );
    res.status(201).json({ idUsuarios: result.insertId, Nombre, Email, Telefono, Estado: estadoValue });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ mensaje: 'Error al crear usuario en la base de datos' });
  }
});

app.put('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const { Nombre, Email, Telefono, contraseña, idRolesFK, idClientesFK, idProveedoresFK, Estado } = req.body;

  try {
    let query = '';
    let params = [];

    if (contraseña) {
      query = 'UPDATE usuarios SET Nombre = ?, Email = ?, Telefono = ?, contraseña = ?, idRolesFK = ?, idClientesFK = ?, idProveedoresFK = ?, Estado = ? WHERE idUsuarios = ?';
      params = [Nombre, Email, Telefono || null, contraseña, idRolesFK || null, idClientesFK || null, idProveedoresFK || null, Estado, id];
    } else {
      query = 'UPDATE usuarios SET Nombre = ?, Email = ?, Telefono = ?, idRolesFK = ?, idClientesFK = ?, idProveedoresFK = ?, Estado = ? WHERE idUsuarios = ?';
      params = [Nombre, Email, Telefono || null, idRolesFK || null, idClientesFK || null, idProveedoresFK || null, Estado, id];
    }

    const [result] = await db.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'No se encontró el usuario para actualizar' });
    }

    res.json({ mensaje: 'Usuario actualizado con éxito' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ mensaje: 'Error al actualizar usuario', detalle: error.message });
  }
});

app.delete('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM usuarios WHERE idUsuarios = ?', [id]);
    res.json({ mensaje: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ mensaje: 'Error al eliminar el usuario' });
  }
});

// ==========================================
// RUTAS DE HABITACIONES
// ==========================================

app.get('/api/habitaciones/unidades', async (req, res) => {
  const { llegada, salida, idSedeFK } = req.query;
  const fechasValidas = llegada && salida && salida > llegada;
  try {
    const fechaSalida = fechasValidas ? salida : null;
    const fechaLlegada = fechasValidas ? llegada : null;
    const [rows] = await db.query(`
      SELECT u.idUnidad, u.numeroHabitacion, u.idSedeFK, s.ciudad AS ciudadSede, s.nombre AS nombreSede, u.estado AS estadoUnidad,
             h.idHabitaciones, h.tipo, h.capacidad, h.precio, h.estado AS estadoTipo,
             (SELECT c.Nombre
              FROM reservas_has_unidades ru2
              JOIN reservas r2 ON r2.idReservas = ru2.idReservasFK
              LEFT JOIN clientes c ON c.idClientes = r2.idClientesFK
              WHERE ru2.idUnidadFK = u.idUnidad
                AND r2.fechaInicio <= CURDATE() AND r2.fechaFin > CURDATE()
                AND LOWER(COALESCE(r2.estado,'pendiente')) NOT IN ('cancelada','cancelado','rechazada','anulada')
              ORDER BY r2.fechaInicio DESC LIMIT 1) AS huesped,
             CASE
               WHEN u.estado = 'Mantenimiento' OR h.estado <> 1 THEN 'Mantenimiento'
               WHEN EXISTS (
                 SELECT 1
                 FROM reservas_has_unidades ru
                 JOIN reservas r ON r.idReservas = ru.idReservasFK
                 WHERE ru.idUnidadFK = u.idUnidad
                   AND r.fechaInicio < COALESCE(?, DATE_ADD(CURDATE(), INTERVAL 1 DAY))
                   AND r.fechaFin > COALESCE(?, CURDATE())
                   AND LOWER(COALESCE(r.estado,'pendiente')) NOT IN ('cancelada','cancelado','rechazada','anulada')
               ) THEN 'Ocupada'
               ELSE 'Disponible'
             END AS estado
      FROM habitaciones_unidades u
      JOIN habitaciones h ON h.idHabitaciones = u.idHabitacionesFK
      LEFT JOIN sedes s ON s.idSedes=u.idSedeFK
      WHERE (? IS NULL OR u.idSedeFK = ?)
      ORDER BY CAST(u.numeroHabitacion AS UNSIGNED), u.numeroHabitacion
    `, [fechaSalida, fechaLlegada, idSedeFK || null, idSedeFK || null]);
    res.json(rows);
  } catch (error) {
    console.error('Error consultando inventario físico:', error);
    res.status(500).json({ mensaje: 'No se pudo consultar el inventario físico.' });
  }
});

// Permite poner una habitación física en mantenimiento o devolverla a disponible.
// No se permite bloquear una unidad que ya tenga reservas vigentes o futuras.
app.patch('/api/habitaciones/unidades/:id/estado', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body || {};
  if (!['Disponible', 'Mantenimiento'].includes(estado)) {
    return res.status(400).json({ mensaje: 'El estado debe ser Disponible o Mantenimiento.' });
  }
  try {
    const [unidades] = await db.query(
      'SELECT idUnidad FROM habitaciones_unidades WHERE idUnidad = ? LIMIT 1', [id]
    );
    if (!unidades.length) return res.status(404).json({ mensaje: 'No existe esa habitación física.' });

    if (estado === 'Mantenimiento') {
      const [reservasActivas] = await db.query(`
        SELECT r.idReservas
        FROM reservas_has_unidades ru
        JOIN reservas r ON r.idReservas = ru.idReservasFK
        WHERE ru.idUnidadFK = ?
          AND r.fechaFin > CURDATE()
          AND LOWER(COALESCE(r.estado,'pendiente')) NOT IN ('cancelada','cancelado','rechazada','anulada')
        LIMIT 1
      `, [id]);
      if (reservasActivas.length) {
        return res.status(409).json({ mensaje: 'No se puede enviar a mantenimiento: la habitación tiene una reserva vigente o futura asignada.' });
      }
    }

    await db.query('UPDATE habitaciones_unidades SET estado = ? WHERE idUnidad = ?', [estado, id]);
    res.json({ mensaje: 'Estado de la habitación actualizado.', estado });
  } catch (error) {
    console.error('Error actualizando estado de habitación física:', error);
    res.status(500).json({ mensaje: 'No se pudo actualizar el estado de la habitación.' });
  }
});

app.get('/api/sedes', async (req, res) => {
  try { const [rows] = await db.query('SELECT idSedes,nombre,ciudad,direccion,telefono FROM sedes WHERE estado=1 ORDER BY ciudad,nombre'); res.json(rows); }
  catch (error) { res.status(500).json({ mensaje: 'No se pudieron consultar las sedes. Ejecuta la migración de sedes.' }); }
});

app.get('/api/habitaciones', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM habitaciones WHERE (? IS NULL OR idSedeFK = ?) ORDER BY idSedeFK, tipo', [req.query.idSedeFK || null, req.query.idSedeFK || null]);
    res.json(rows);
  } catch (error) {
    console.error('Error detallado al consultar habitaciones:', error);
    res.status(500).json({ mensaje: 'Error al consultar habitaciones', error: error.message });
  }
});

app.post('/api/habitaciones', async (req, res) => {
  const { tipo, capacidad, cantidad = 1, precio, estado, descripcion, imagen, idSedeFK = 1 } = req.body;
  const estadoVal = estado !== undefined ? estado : 1;
  const cantidadVal = Math.max(1, Number.parseInt(cantidad, 10) || 1);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      'INSERT INTO habitaciones (tipo, capacidad, cantidad, precio, estado, descripcion, imagen, idSedeFK) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [tipo, capacidad, cantidadVal, Number(precio) || 0, estadoVal, descripcion || '', imagen || '', Number(idSedeFK) || 1]
    );
    for (let n = 1; n <= cantidadVal; n++) {
      await connection.query('INSERT INTO habitaciones_unidades (idHabitacionesFK,numeroHabitacion,estado,idSedeFK) VALUES (?,?,?,?)',
        [result.insertId, `${result.insertId}${String(n).padStart(2,'0')}`, 'Disponible', Number(idSedeFK) || 1]);
    }
    await connection.commit();
    res.status(201).json({ idHabitaciones: result.insertId, tipo, capacidad, cantidad: cantidadVal, precio: Number(precio) || 0, estado: estadoVal, descripcion, imagen: imagen || '', idSedeFK: Number(idSedeFK) || 1 });
  } catch (error) {
    await connection.rollback();
    console.error('Error al crear habitación:', error);
    res.status(500).json({ mensaje: 'Error al crear la habitación', error: error.message });
  } finally { connection.release(); }
});

app.put('/api/habitaciones/:id', async (req, res) => {
  const { id } = req.params;
  const { tipo, capacidad, cantidad = 1, precio, estado, descripcion, imagen, idSedeFK = 1 } = req.body;

  try {
    const [result] = await db.query(
      'UPDATE habitaciones SET tipo = ?, capacidad = ?, cantidad = ?, precio = ?, estado = ?, descripcion = ?, imagen = ?, idSedeFK=? WHERE idHabitaciones = ?',
      [tipo, capacidad, Math.max(1, Number.parseInt(cantidad, 10) || 1), Number(precio) || 0, estado, descripcion || '', imagen || '', Number(idSedeFK) || 1, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'No se encontró la habitación' });
    }
    res.json({ mensaje: 'Habitación actualizada con éxito' });
  } catch (error) {
    console.error('Error al actualizar habitación:', error);
    res.status(500).json({ mensaje: 'Error al actualizar habitación', detalle: error.message });
  }
});

app.delete('/api/habitaciones/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM habitaciones WHERE idHabitaciones = ?', [id]);
    res.json({ mensaje: 'Habitación eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar habitación:', error);
    res.status(500).json({ mensaje: 'Error al eliminar la habitación', error: error.message });
  }
});

// ==========================================
// RUTAS DE SERVICIOS
// ==========================================

app.get('/api/servicios', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT idServicios, nombre, precio, estado, imagen FROM servicios');
    res.json(rows);
  } catch (error) {
    console.error('Error al consultar servicios:', error);
    res.status(500).json({ mensaje: 'Error al consultar servicios', error: error.message });
  }
});

app.post('/api/servicios', async (req, res) => {
  const { nombre, precio, estado, imagen } = req.body;
  const estadoVal = estado !== undefined ? estado : 1;

  if (!nombre || precio === undefined) {
    return res.status(400).json({ mensaje: 'El nombre y el precio son obligatorios' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO servicios (nombre, precio, estado, imagen) VALUES (?, ?, ?, ?)',
      [nombre, precio, estadoVal, imagen || '']
    );
    res.status(201).json({ idServicios: result.insertId, nombre, precio, estado: estadoVal, imagen: imagen || '' });
  } catch (error) {
    console.error('Error al crear servicio:', error);
    res.status(500).json({ mensaje: 'Error al crear servicio', error: error.message });
  }
});

app.put('/api/servicios/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, estado, imagen } = req.body;

  try {
    const [result] = await db.query(
      'UPDATE servicios SET nombre = ?, precio = ?, estado = ?, imagen = ? WHERE idServicios = ?',
      [nombre, precio, estado !== undefined ? estado : 1, imagen || '', id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'No se encontró el servicio' });
    }

    res.json({ mensaje: 'Servicio actualizado con éxito' });
  } catch (error) {
    console.error('Error al actualizar servicio:', error);
    res.status(500).json({ mensaje: 'Error al actualizar servicio', detalle: error.message });
  }
});

app.delete('/api/servicios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM servicios WHERE idServicios = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'No se encontró el servicio para eliminar' });
    }

    res.json({ mensaje: 'Servicio eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar servicio:', error);
    res.status(500).json({ mensaje: 'Error al eliminar servicio', error: error.message });
  }
});

// ==========================================
// RUTAS DE PAQUETES
// ==========================================

app.get('/api/paquetes', async (req, res) => {
  try {
    // Consultar paquetes y servicios incluidos por separado evita depender de
    // GROUP_CONCAT (límites de longitud, GROUP BY y formato devuelto por MySQL).
    const [paquetesRows] = await db.query(`
      SELECT p.idPaquetes, p.nomPaquete, p.tipo, p.descripcion, p.precioPaquete,
             p.imagen, p.estado, p.idHabitacionesFK, p.idSedeFK, s.ciudad, s.nombre AS nombreSede,
             h.tipo AS habitacionIncluidaTipo,
             h.precio AS precioHabitacionIncluida
      FROM paquetes p
      LEFT JOIN habitaciones h ON h.idHabitaciones = p.idHabitacionesFK
      LEFT JOIN sedes s ON s.idSedes=p.idSedeFK
      WHERE (? IS NULL OR p.idSedeFK = ?)\n      ORDER BY p.idPaquetes DESC\n    `, [req.query.idSedeFK || null, req.query.idSedeFK || null]);

    const [relacionesRows] = await db.query(`
      SELECT Paquetes_idPaquetes AS idPaquete,
             servicios_idServicios AS idServicio
      FROM servicios_has_paquetes
    `);

    const serviciosPorPaquete = new Map();
    for (const relacion of relacionesRows) {
      const idPaquete = Number(relacion.idPaquete);
      const idServicio = Number(relacion.idServicio);
      if (!Number.isInteger(idPaquete) || !Number.isInteger(idServicio)) continue;
      if (!serviciosPorPaquete.has(idPaquete)) serviciosPorPaquete.set(idPaquete, []);
      const lista = serviciosPorPaquete.get(idPaquete);
      if (!lista.includes(idServicio)) lista.push(idServicio);
    }

    res.json(paquetesRows.map(paquete => ({
      ...paquete,
      idPaquetes: Number(paquete.idPaquetes),
      idHabitacionesFK: paquete.idHabitacionesFK == null ? null : Number(paquete.idHabitacionesFK),
      serviciosIncluidos: serviciosPorPaquete.get(Number(paquete.idPaquetes)) || []
    })));
  } catch (err) {
    console.error('Error en GET /api/paquetes:', err);
    res.status(500).json({ error: 'Error al obtener paquetes y sus servicios incluidos.', detalle: err.message });
  }
});

app.post('/api/paquetes', async (req, res) => {
  const { nomPaquete, tipo, descripcion, precioPaquete, imagen, idHabitacionesFK, idSedeFK = 1, serviciosIncluidos = [] } = req.body || {};
  if (!nomPaquete?.trim() || !Number.isFinite(Number(precioPaquete)) || Number(precioPaquete) < 0 || !idHabitacionesFK) {
    return res.status(400).json({ error: 'Indica nombre, precio y la habitación incluida en el paquete.' });
  }
  const connection = await db.getConnection();
  try {
    const [habitacionValida] = await connection.query('SELECT idHabitaciones FROM habitaciones WHERE idHabitaciones = ? AND idSedeFK = ? LIMIT 1', [Number(idHabitacionesFK), Number(idSedeFK)]);
    if (!habitacionValida.length) return res.status(400).json({ error: 'La habitación incluida debe pertenecer a la misma sede del paquete.' });
    await connection.beginTransaction();
    const [result] = await connection.query(`INSERT INTO paquetes
      (nomPaquete, tipo, descripcion, precioPaquete, imagen, idHabitacionesFK, noches, estado, idSedeFK)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)`, [nomPaquete.trim(), tipo || '', descripcion || '', Number(precioPaquete), imagen || '', Number(idHabitacionesFK), Number(idSedeFK)]);
    const ids = [...new Set((Array.isArray(serviciosIncluidos) ? serviciosIncluidos : []).map(Number).filter(Number.isInteger))];
    for (const servicioId of ids) await connection.query('INSERT IGNORE INTO servicios_has_paquetes (servicios_idServicios, Paquetes_idPaquetes) VALUES (?, ?)', [servicioId, result.insertId]);
    await connection.commit();
    res.status(201).json({ message: 'Paquete creado correctamente', idPaquetes: result.insertId });
  } catch (error) {
    await connection.rollback();
    console.error('Error al crear paquete:', error);
    res.status(500).json({ error: 'Error al crear paquete. Verifica la migración y la habitación seleccionada.' });
  } finally { connection.release(); }
});

app.put('/api/paquetes/:id', async (req, res) => {
  const { id } = req.params;
  const { nomPaquete, tipo, descripcion, precioPaquete, imagen, idHabitacionesFK, idSedeFK = 1, serviciosIncluidos = [] } = req.body || {};
  if (!nomPaquete?.trim() || !Number.isFinite(Number(precioPaquete)) || Number(precioPaquete) < 0 || !idHabitacionesFK) {
    return res.status(400).json({ error: 'Indica nombre, precio y la habitación incluida en el paquete.' });
  }
  const connection = await db.getConnection();
  try {
    const [habitacionValida] = await connection.query('SELECT idHabitaciones FROM habitaciones WHERE idHabitaciones = ? AND idSedeFK = ? LIMIT 1', [Number(idHabitacionesFK), Number(idSedeFK)]);
    if (!habitacionValida.length) return res.status(400).json({ error: 'La habitación incluida debe pertenecer a la misma sede del paquete.' });
    await connection.beginTransaction();
    const [result] = await connection.query(`UPDATE paquetes SET nomPaquete = ?, tipo = ?, descripcion = ?, precioPaquete = ?, imagen = ?, idHabitacionesFK = ?, idSedeFK=? WHERE idPaquetes = ?`,
      [nomPaquete.trim(), tipo || '', descripcion || '', Number(precioPaquete), imagen || '', Number(idHabitacionesFK), Number(idSedeFK), id]);
    if (!result.affectedRows) { await connection.rollback(); return res.status(404).json({ error: 'Paquete no encontrado' }); }
    await connection.query('DELETE FROM servicios_has_paquetes WHERE Paquetes_idPaquetes = ?', [id]);
    const ids = [...new Set((Array.isArray(serviciosIncluidos) ? serviciosIncluidos : []).map(Number).filter(Number.isInteger))];
    for (const servicioId of ids) await connection.query('INSERT IGNORE INTO servicios_has_paquetes (servicios_idServicios, Paquetes_idPaquetes) VALUES (?, ?)', [servicioId, id]);
    await connection.commit();
    res.json({ message: 'Paquete actualizado correctamente' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al actualizar paquete:', error);
    res.status(500).json({ error: 'Error al actualizar paquete. Verifica la migración y la habitación seleccionada.' });
  } finally { connection.release(); }
});

app.delete('/api/paquetes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM paquetes WHERE idPaquetes = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Paquete no encontrado' });
    }

    res.json({ message: 'Paquete eliminado correctamente' });
  } catch (err) {
    console.error('Error en DELETE /api/paquetes:', err);
    res.status(500).json({ error: 'Error al eliminar paquete' });
  }
});

// ==========================================
// RUTAS DE CLIENTES
// ==========================================


// ==========================================
// COMENTARIOS Y MENSAJES DE SOPORTE
// ==========================================
app.get('/api/comentarios', exigirToken, async (req, res) => {
  try {
    const [rolRows] = await db.query('SELECT nomRol FROM roles WHERE idRoles=? LIMIT 1', [req.sesion.idRolesFK]);
    const rol = normalizarPermiso(rolRows[0]?.nomRol || '');
    const esSoporte = ['gerente','superadmin','administrador','admin','soportetecnico','soporte','personaldeapoyo'].includes(rol);
    const [rows] = await db.query(`
      SELECT c.idComentario, c.mensaje, c.fechaCreacion, c.idUsuariosFK, c.idClientesFK,
             u.Nombre AS autor, r.nomRol AS rolAutor
      FROM comentarios c JOIN usuarios u ON u.idUsuarios=c.idUsuariosFK
      LEFT JOIN roles r ON r.idRoles=u.idRolesFK
      WHERE (? = 1 OR c.idClientesFK = ?)
      ORDER BY c.fechaCreacion ASC, c.idComentario ASC
    `, [esSoporte ? 1 : 0, req.sesion.idClientesFK || 0]);
    res.json(rows);
  } catch (error) {
    console.error('Error consultando comentarios:', error);
    res.status(500).json({ mensaje: 'No fue posible consultar los comentarios.' });
  }
});
app.post('/api/comentarios', exigirToken, async (req, res) => {
  const mensaje = String(req.body?.mensaje || '').trim();
  const clienteObjetivo = Number(req.body?.idClientesFK || req.sesion?.idClientesFK || 0);
  if (!mensaje || mensaje.length > 2000) return res.status(400).json({ mensaje: 'Escribe un comentario de hasta 2.000 caracteres.' });
  try {
    const [userRows] = await db.query(`SELECT u.idUsuarios, u.Estado, r.nomRol
      FROM usuarios u LEFT JOIN roles r ON r.idRoles=u.idRolesFK
      WHERE u.idUsuarios=? LIMIT 1`, [req.sesion.idUsuarios]);
    if (!userRows.length || Number(userRows[0].Estado) !== 1) return res.status(403).json({ mensaje: 'Tu cuenta no está activa.' });
    const rol = normalizarPermiso(userRows[0].nomRol || '');
    const esSoporte = ['gerente','superadmin','administrador','admin','soportetecnico','soporte','personaldeapoyo'].includes(rol);
    if (!esSoporte && rol !== 'cliente') return res.status(403).json({ mensaje: 'Tu rol no puede participar en este canal.' });
    if (!clienteObjetivo) return res.status(400).json({ mensaje: 'No se pudo identificar el hilo de conversación.' });
    if (!esSoporte && Number(req.sesion.idClientesFK) !== clienteObjetivo) return res.status(403).json({ mensaje: 'No puedes escribir en la conversación de otro cliente.' });
    const [result] = await db.query('INSERT INTO comentarios (idUsuariosFK, idClientesFK, mensaje) VALUES (?, ?, ?)', [req.sesion.idUsuarios, clienteObjetivo, mensaje]);
    res.status(201).json({ idComentario: result.insertId, mensaje: 'Comentario publicado.' });
  } catch (error) {
    console.error('Error guardando comentario:', error);
    res.status(500).json({ mensaje: 'No fue posible publicar el comentario.' });
  }
});

app.get('/api/clientes', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM clientes');
    res.json(results);
  } catch (err) {
    console.error('Error al obtener clientes:', err);
    res.status(500).json({ error: 'Error al consultar la base de datos' });
  }
});

app.post('/api/clientes', async (req, res) => {
  const { Nombre, Email, Telefono, Estado } = req.body;
  try {
    const sql = 'INSERT INTO clientes (Nombre, Email, Telefono, Estado) VALUES (?, ?, ?, ?)';
    const [result] = await db.query(sql, [Nombre, Email, Telefono, Estado ?? 1]);
    res.json({ message: 'Cliente registrado con éxito', id: result.insertId });
  } catch (err) {
    console.error('Error al insertar cliente:', err);
    res.status(500).json({ error: 'Error al guardar cliente' });
  }
});

app.put('/api/clientes/:id', async (req, res) => {
  const { id } = req.params;
  const { Nombre, Email, Telefono, Estado } = req.body;
  try {
    const sql = 'UPDATE clientes SET Nombre = ?, Email = ?, Telefono = ?, Estado = ? WHERE idClientes = ?';
    await db.query(sql, [Nombre, Email, Telefono, Estado, id]);
    res.json({ message: 'Cliente actualizado correctamente' });
  } catch (err) {
    console.error('Error al actualizar cliente:', err);
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

app.delete('/api/clientes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const sql = 'DELETE FROM clientes WHERE idClientes = ?';
    await db.query(sql, [id]);
    res.json({ message: 'Cliente eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar cliente:', err);
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});



// Asigna números físicos reales dentro de la misma transacción de la reserva.
// Cada unidad se bloquea y se vuelve a comprobar por fechas para impedir dobles asignaciones.
async function asignarUnidadesFisicas(connection, reservaId, grupos, inicio, fin, excluirReservaId = null, idSedeFK = null) {
  if (!inicio || !fin || !(fin > inicio)) throw new Error('Las fechas de la reserva no son válidas.');
  for (const grupo of grupos) {
    const tipoId = Number(grupo.idHabitaciones);
    const cantidad = Math.max(1, Number(grupo.cantidadHabitaciones) || 1);
    // Mutex por categoría: serializa las asignaciones concurrentes del mismo inventario.
    await connection.query('SELECT idHabitaciones FROM habitaciones WHERE idHabitaciones = ? FOR UPDATE', [tipoId]);
    const [unidades] = await connection.query(`
      SELECT u.idUnidad, u.numeroHabitacion
      FROM habitaciones_unidades u
      WHERE u.idHabitacionesFK = ? AND u.estado = 'Disponible' AND (? IS NULL OR u.idSedeFK=?)
        AND NOT EXISTS (
          SELECT 1 FROM reservas_has_unidades ru
          JOIN reservas r ON r.idReservas = ru.idReservasFK
          WHERE ru.idUnidadFK = u.idUnidad
            AND r.fechaInicio < ? AND r.fechaFin > ?
            AND LOWER(COALESCE(r.estado,'pendiente')) NOT IN ('cancelada','cancelado','rechazada','anulada')
            AND (? IS NULL OR r.idReservas <> ?)
        )
      ORDER BY CAST(u.numeroHabitacion AS UNSIGNED), u.numeroHabitacion
      LIMIT ? FOR UPDATE
    `, [tipoId, idSedeFK, idSedeFK, fin, inicio, excluirReservaId, excluirReservaId, cantidad]);
    if (unidades.length < cantidad) {
      throw new Error(`No hay suficientes habitaciones físicas de tipo ${grupo.tipo || tipoId} para esas fechas. Disponibles: ${unidades.length}; solicitadas: ${cantidad}.`);
    }
    for (const unidad of unidades) {
      await connection.query(
        'INSERT INTO reservas_has_unidades (idReservasFK, idUnidadFK) VALUES (?, ?)',
        [reservaId, unidad.idUnidad]
      );
    }
  }
}

async function elegirHabitacionesPorCapacidad(connection, inicio, fin, personas, preferidaId, paqueteId, idSedeFK = null) {
  const huespedes = Math.max(1, Number.parseInt(personas, 10) || 1);
  const [disponibles] = await connection.query(`
    SELECT h.idHabitaciones, h.tipo, h.capacidad, h.precio,
      (SELECT COUNT(*) FROM habitaciones_unidades u
       WHERE u.idHabitacionesFK=h.idHabitaciones AND u.estado='Disponible' AND (? IS NULL OR u.idSedeFK=?)
         AND NOT EXISTS (
           SELECT 1 FROM reservas_has_unidades ru JOIN reservas r ON r.idReservas=ru.idReservasFK
           WHERE ru.idUnidadFK=u.idUnidad AND r.fechaInicio < ? AND r.fechaFin > ?
             AND LOWER(COALESCE(r.estado,'pendiente')) NOT IN ('cancelada','cancelado','rechazada','anulada')
         )) AS unidadesDisponibles
    FROM habitaciones h WHERE h.estado=1 AND (? IS NULL OR h.idSedeFK = ?)
    HAVING unidadesDisponibles > 0
    ORDER BY h.precio ASC
    FOR UPDATE
  `, [idSedeFK || null, idSedeFK || null, fin, inicio, idSedeFK || null, idSedeFK || null]);
  const capacidad = h => Math.max(1, Number.parseInt(String(h.capacidad || '').match(/\d+/)?.[0] || '1', 10));
  const grupos = [];
  const usadas = new Map();
  let pendientes = huespedes;
  const agregar = h => {
    const grupo = grupos.find(x => Number(x.idHabitaciones) === Number(h.idHabitaciones));
    if (grupo) grupo.cantidadHabitaciones += 1;
    else grupos.push({ idHabitaciones: Number(h.idHabitaciones), tipo: h.tipo, cantidadHabitaciones: 1 });
    usadas.set(Number(h.idHabitaciones), (usadas.get(Number(h.idHabitaciones)) || 0) + 1);
    pendientes -= Math.min(pendientes, capacidad(h));
  };
  let base = paqueteId
    ? disponibles.find(h => Number(h.idHabitaciones) === Number(preferidaId))
    : disponibles.find(h => Number(h.idHabitaciones) === Number(preferidaId));
  if (!base) throw new Error('La habitación base no tiene unidades físicas disponibles para esas fechas.');
  agregar(base);
  const ordenadas = [...disponibles].sort((a,b) => capacidad(b)-capacidad(a) || Number(a.precio)-Number(b.precio));
  while (pendientes > 0) {
    const siguiente = ordenadas.find(h => (usadas.get(Number(h.idHabitaciones)) || 0) < Number(h.unidadesDisponibles));
    if (!siguiente) throw new Error(`No hay habitaciones físicas suficientes para alojar a ${huespedes} huésped(es).`);
    agregar(siguiente);
  }
  return grupos;
}

async function calcularTotalDesdeInventario(connection, grupos, paqueteId, serviciosIds, inicio, fin) {
  const noches = Math.max(1, Math.ceil((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000));
  let total = 0;
  let habitacionIncluidaId = null;
  if (paqueteId) {
    const [paquetes] = await connection.query(
      'SELECT precioPaquete, idHabitacionesFK FROM paquetes WHERE idPaquetes = ? LIMIT 1', [paqueteId]
    );
    if (!paquetes.length) throw new Error('El paquete seleccionado no existe.');
    total = Number(paquetes[0].precioPaquete) || 0;
    habitacionIncluidaId = Number(paquetes[0].idHabitacionesFK);
  }
  for (const grupo of grupos) {
    const [habitaciones] = await connection.query(
      'SELECT precio FROM habitaciones WHERE idHabitaciones = ? LIMIT 1', [grupo.idHabitaciones]
    );
    if (!habitaciones.length) throw new Error('Una de las categorías de habitación ya no existe.');
    const precio = Number(habitaciones[0].precio) || 0;
    const cantidad = Math.max(1, Number(grupo.cantidadHabitaciones) || 1);
    if (paqueteId && Number(grupo.idHabitaciones) === habitacionIncluidaId) {
      total += precio * noches * Math.max(0, cantidad - 1);
    } else {
      total += precio * noches * cantidad;
    }
  }
  const ids = [...new Set((Array.isArray(serviciosIds) ? serviciosIds : []).map(Number).filter(x => Number.isInteger(x) && x > 0))];
  if (ids.length) {
    const [incluidos] = paqueteId
      ? await connection.query('SELECT servicios_idServicios FROM servicios_has_paquetes WHERE Paquetes_idPaquetes = ?', [paqueteId])
      : [[]];
    const excluidos = new Set(incluidos.map(x => Number(x.servicios_idServicios)));
    const extras = ids.filter(x => !excluidos.has(x));
    if (extras.length) {
      const [servicios] = await connection.query(
        `SELECT COALESCE(SUM(precio),0) AS totalServicios FROM servicios WHERE estado=1 AND idServicios IN (${extras.map(() => '?').join(',')})`,
        extras
      );
      total += Number(servicios[0]?.totalServicios || 0);
    }
  }
  return total;
}

async function validarDisponibilidadHabitacion(connection, habitacionId, inicio, fin, excluirId=null, idSedeFK=null) {
  if(!habitacionId||!inicio||!fin||!(fin>inicio)) throw new Error('Selecciona una habitación y fechas válidas.');
  const [hab]=await connection.query('SELECT cantidad,estado FROM habitaciones WHERE idHabitaciones=? FOR UPDATE',[habitacionId]);
  if(!hab.length||Number(hab[0].estado)!==1)throw new Error('La habitación no está activa.');
  const params=[habitacionId,habitacionId,fin,inicio];
  const excluir=excluirId?' AND r.idReservas <> ?':'';
  if(excluirId)params.push(excluirId);
  const [ocupadas]=await connection.query(`SELECT COALESCE(SUM(COALESCE(rhh.cantidadHabitaciones,1)),0) ocupadas
    FROM reservas r LEFT JOIN reservas_has_habitaciones rhh ON rhh.idReservasFK=r.idReservas AND rhh.idHabitacionesFK=?
    WHERE (r.idHabitacionesFK=? OR rhh.idHabitacionesFK IS NOT NULL)
    AND r.fechaInicio < ? AND r.fechaFin > ?
    AND (? IS NULL OR r.idSedeFK=?)
    AND LOWER(COALESCE(r.estado,'')) NOT IN ('cancelada','cancelado') ${excluir}`,[...params.slice(0,4),idSedeFK,idSedeFK,...params.slice(4)]);
  if(Number(ocupadas[0]?.ocupadas||0)>=Number(hab[0].cantidad||1))throw new Error('La habitación ya está reservada en esas fechas. Escoge otra fecha o habitación.');
}

// ==========================================
// RUTAS DE RESERVAS
// ==========================================

// Disponibilidad pública: devuelve habitaciones activas que no tienen una reserva solapada.
app.get('/api/disponibilidad', async (req, res) => {
  const { llegada, salida, personas = 1, idSedeFK } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(llegada || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(salida || '')) || !(salida > llegada)) {
    return res.status(400).json({ mensaje: 'Selecciona una fecha de llegada y una fecha de salida posterior.' });
  }
  try {
    // Cada fila activa de habitaciones representa una unidad reservable. Se excluyen
    // tanto reservas antiguas (FK principal) como todas las habitaciones de reservas múltiples.
    const [rows] = await db.query(`
      SELECT h.idHabitaciones, h.tipo, h.capacidad, h.cantidad,
        (SELECT COUNT(*) FROM habitaciones_unidades u
         WHERE u.idHabitacionesFK=h.idHabitaciones AND u.estado='Disponible' AND (? IS NULL OR u.idSedeFK=?)
           AND NOT EXISTS (
             SELECT 1 FROM reservas_has_unidades ru JOIN reservas r ON r.idReservas=ru.idReservasFK
             WHERE ru.idUnidadFK=u.idUnidad
               AND r.fechaInicio < ? AND r.fechaFin > ?
               AND LOWER(COALESCE(r.estado,'pendiente')) NOT IN ('cancelada','cancelado','rechazada','anulada')
           )
        ) AS unidadesDisponibles,
        h.precio, h.descripcion, h.imagen
      FROM habitaciones h WHERE h.estado=1 AND (? IS NULL OR h.idSedeFK = ?)
      HAVING unidadesDisponibles > 0
      ORDER BY h.precio ASC, h.capacidad DESC
    `, [idSedeFK || null, idSedeFK || null, salida, llegada, idSedeFK || null, idSedeFK || null]);
    const cantidad = Math.max(1, Number.parseInt(personas, 10) || 1);
    res.json({ llegada, salida, personas: cantidad, habitaciones: rows });
  } catch (error) {
    console.error('Error consultando disponibilidad:', error);
    res.status(500).json({ mensaje: 'No se pudo consultar la disponibilidad. Ejecuta la migración de reservas con varias habitaciones y verifica las tablas.' });
  }
});

// Registro de una reserva que puede incluir varias habitaciones. El precio y la disponibilidad
// se recalculan dentro de una transacción; el precio enviado por el navegador nunca se usa.
// Registro de una reserva que puede incluir varias habitaciones.
app.post('/api/reservas/cliente', async (req, res) => {
  const {
    idHabitacionesFK,
    idPaquetesFK,
    serviciosSeleccionados = [],
    fechaInicio,
    fechaFin,
    personas = 1,
    horaLlegada = '15:00',
    horaSalida = '12:00',
    metodoPago = 'Efectivo',
    comprobantePago = null
  } = req.body || {};

  // IMPORTANTE: debe ser let porque puede cambiar si se selecciona un paquete.
  let idSedeFK = req.body?.idSedeFK ?? null;

  if (!['Efectivo', 'Tarjeta', 'Transferencia'].includes(metodoPago)) {
    return res.status(400).json({ mensaje: 'Selecciona un método de pago válido.' });
  }

  if (metodoPago === 'Transferencia' && !comprobantePago) {
    return res.status(400).json({ mensaje: 'Adjunta el comprobante para registrar el pago por transferencia.' });
  }

  if (
    (!idHabitacionesFK && !idPaquetesFK) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(fechaInicio || '')) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(fechaFin || '')) ||
    !(fechaFin > fechaInicio)
  ) {
    return res.status(400).json({ mensaje: 'Selecciona un paquete o habitación y fechas válidas.' });
  }

  const cantidad = Math.max(1, Number.parseInt(personas, 10) || 1);
  const noches = Math.ceil(
    (Date.parse(`${fechaFin}T00:00:00Z`) - Date.parse(`${fechaInicio}T00:00:00Z`)) / 86400000
  );

  if (noches < 1) {
    return res.status(400).json({ mensaje: 'La salida debe ser posterior a la llegada.' });
  }

  const connection = await db.getConnection();

  let reservationId;
let emailCliente = '';
let nombreCliente = '';
let estadoReserva = 'Pendiente';
let total = 0;
let detalleCorreo = {};
let numerosAsignados = [];
let serviciosPDF = [];
let codigoReserva = '';
let archivoComprobante = null;
let ciudadSedeReserva = 'Sede principal';
let paqueteNombre = '';

  try {
    await connection.beginTransaction();

    const [usuarios] = await connection.query(
      'SELECT idUsuarios, idClientesFK, Nombre, Email, Estado FROM usuarios WHERE idUsuarios = ? LIMIT 1',
      [req.sesion.idUsuarios]
    );

    if (!usuarios.length || Number(usuarios[0].Estado) !== 1 || !usuarios[0].idClientesFK) {
      await connection.rollback();
      return res.status(400).json({
        mensaje: 'La cuenta no está vinculada a un registro de cliente válido.'
      });
    }

    const usuario = usuarios[0];
    emailCliente = usuario.Email;
    nombreCliente = usuario.Nombre;

    let paquete = null;
    let incluidos = [];

    if (idPaquetesFK) {
      const [paquetesRows] = await connection.query(`
        SELECT
          p.idPaquetes,
          p.nomPaquete,
          p.precioPaquete,
          p.idHabitacionesFK,
          p.idSedeFK,
          h.tipo AS tipoHabitacionBase,
          h.precio AS precioHabitacionBase,
          h.capacidad AS capacidadHabitacionBase,
          s.ciudad AS ciudadSede
        FROM paquetes p
        LEFT JOIN habitaciones h ON h.idHabitaciones = p.idHabitacionesFK
        LEFT JOIN sedes s ON s.idSedes = p.idSedeFK
        WHERE p.idPaquetes = ?
          AND (p.estado = 1 OR p.estado IS NULL)
        LIMIT 1
      `, [idPaquetesFK]);

      if (!paquetesRows.length || !paquetesRows[0].idHabitacionesFK) {
        await connection.rollback();
        return res.status(400).json({
          mensaje: 'El paquete seleccionado no tiene una habitación incluida configurada en Gestión de Paquetes.'
        });
      }

      paquete = paquetesRows[0];
      paqueteNombre = paquete.nomPaquete || 'Paquete seleccionado';

      if (idSedeFK && Number(idSedeFK) !== Number(paquete.idSedeFK)) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'El paquete seleccionado pertenece a otra sede. Cambia la sede antes de reservar.' });
      }
      idSedeFK = paquete.idSedeFK || idSedeFK;

      const [incluidosRows] = await connection.query(
        'SELECT servicios_idServicios FROM servicios_has_paquetes WHERE Paquetes_idPaquetes = ?',
        [idPaquetesFK]
      );

      incluidos = incluidosRows.map(r => Number(r.servicios_idServicios));
    }

    const [sedeRowsReserva] = await connection.query(
      'SELECT ciudad FROM sedes WHERE idSedes = ? LIMIT 1',
      [idSedeFK || 1]
    );

    ciudadSedeReserva = sedeRowsReserva[0]?.ciudad || 'Sede principal';

    const [disponiblesRows] = await connection.query(`
      SELECT
        h.idHabitaciones,
        h.tipo,
        h.capacidad,
        h.cantidad,
        h.precio,
        h.estado,
        (
          SELECT COUNT(*)
          FROM habitaciones_unidades u
          WHERE u.idHabitacionesFK = h.idHabitaciones
            AND u.estado = 'Disponible'
            AND (? IS NULL OR u.idSedeFK = ?)
            AND NOT EXISTS (
              SELECT 1
              FROM reservas_has_unidades ru
              JOIN reservas r ON r.idReservas = ru.idReservasFK
              WHERE ru.idUnidadFK = u.idUnidad
                AND r.fechaInicio < ?
                AND r.fechaFin > ?
                AND LOWER(COALESCE(r.estado, 'pendiente'))
                  NOT IN ('cancelada', 'cancelado', 'rechazada', 'anulada')
            )
        ) AS unidadesDisponibles
      FROM habitaciones h
      WHERE h.estado = 1
      HAVING unidadesDisponibles > 0
      ORDER BY h.precio ASC, h.capacidad DESC
      FOR UPDATE
    `, [idSedeFK || null, idSedeFK || null, fechaFin, fechaInicio]);

    const disponibles = disponiblesRows;

    if (!disponibles.length) {
      await connection.rollback();
      return res.status(409).json({
        mensaje: 'No hay habitaciones disponibles para las fechas seleccionadas.'
      });
    }

    const asignadas = [];
    let personasPendientes = cantidad;
    let cargoHabitacionesExtra = 0;
    let excedenteMejora = 0;

    const capacidadDe = h =>
      Math.max(1, Number.parseInt(String(h.capacidad || '').match(/\d+/)?.[0] || '1', 10));

    const unidadesDe = h =>
      Math.max(0, Number.parseInt(h.unidadesDisponibles ?? h.cantidad ?? 1, 10) || 0);

    const unidadesUsadas = new Map();

    const agregarUnidad = (h, incluida = false) => {
      const capacidad = capacidadDe(h);
      const personasAsignadas = Math.min(personasPendientes, capacidad);

      const actual = asignadas.find(
        x => Number(x.idHabitaciones) === Number(h.idHabitaciones)
      );

      if (actual) {
        actual.cantidadHabitaciones += 1;
        actual.personasAsignadas += personasAsignadas;
        actual.incluida = actual.incluida || incluida;
      } else {
        asignadas.push({
          ...h,
          incluida,
          personasAsignadas,
          cantidadHabitaciones: 1
        });
      }

      personasPendientes -= personasAsignadas;

      unidadesUsadas.set(
        Number(h.idHabitaciones),
        (unidadesUsadas.get(Number(h.idHabitaciones)) || 0) + 1
      );
    };

    if (paquete) {
      const tipoBase = String(paquete.tipoHabitacionBase || '').trim().toLowerCase();

      let base = disponibles.find(
        h => String(h.idHabitaciones) === String(idHabitacionesFK) && unidadesDe(h) > 0
      );

      if (!base) {
        base = disponibles.find(
          h => String(h.idHabitaciones) === String(paquete.idHabitacionesFK) && unidadesDe(h) > 0
        );
      }

      if (!base && tipoBase) {
        base = disponibles.find(
          h => String(h.tipo || '').trim().toLowerCase() === tipoBase && unidadesDe(h) > 0
        );
      }

      if (!base) {
        base = [...disponibles].sort(
          (a, b) => capacidadDe(b) - capacidadDe(a) ||
            Number(a.precio || 0) - Number(b.precio || 0)
        )[0];
      }

      if (!base) {
        await connection.rollback();
        return res.status(409).json({
          mensaje: 'No hay habitaciones disponibles para el paquete en esas fechas.'
        });
      }

      agregarUnidad(base, true);

      excedenteMejora =
        (Number(base.precio || 0) - Number(paquete.precioHabitacionBase || 0)) * noches;

    } else {
      const preferida = disponibles.find(
        h => String(h.idHabitaciones) === String(idHabitacionesFK) && unidadesDe(h) > 0
      );

      if (!preferida) {
        await connection.rollback();
        return res.status(409).json({
          mensaje: 'La habitación elegida ya no está disponible. Consulta la disponibilidad otra vez.'
        });
      }

      agregarUnidad(preferida, false);
    }

    const candidatas = [...disponibles].sort(
      (a, b) => capacidadDe(b) - capacidadDe(a) ||
        Number(a.precio || 0) - Number(b.precio || 0)
    );

    while (personasPendientes > 0) {
      const siguiente = candidatas.find(
        h => (unidadesUsadas.get(Number(h.idHabitaciones)) || 0) < unidadesDe(h)
      );

      if (!siguiente) {
        await connection.rollback();
        return res.status(409).json({
          mensaje: `No hay suficientes habitaciones disponibles para alojar a ${cantidad} huésped(es) en esas fechas.`
        });
      }

      agregarUnidad(siguiente, false);

      if (paquete) {
        cargoHabitacionesExtra += Number(siguiente.precio || 0) * noches;
      }
    }

    if (paquete) {
      total = Math.max(
        0,
        Number(paquete.precioPaquete || 0) +
        cargoHabitacionesExtra +
        excedenteMejora
      );
    } else {
      total = asignadas.reduce(
        (sum, h) => sum + Number(h.precio || 0) * noches * h.cantidadHabitaciones,
        0
      );
    }

    const idsServicios = Array.isArray(serviciosSeleccionados)
      ? [...new Set(serviciosSeleccionados.map(Number).filter(Number.isInteger))]
      : [];

    let nombresServicios = [];

    if (idsServicios.length) {
      const placeholders = idsServicios.map(() => '?').join(',');

      const [serviciosRows] = await connection.query(
        `SELECT idServicios, nombre, precio
         FROM servicios
         WHERE estado = 1 AND idServicios IN (${placeholders})`,
        idsServicios
      );

      if (serviciosRows.length !== idsServicios.length) {
        await connection.rollback();
        return res.status(400).json({
          mensaje: 'Uno de los servicios seleccionados ya no está disponible.'
        });
      }

      nombresServicios = serviciosRows.map(s => s.nombre);
      serviciosPDF = serviciosRows
        .filter(s => !incluidos.includes(Number(s.idServicios)))
        .map(s => ({ nombre: s.nombre, precio: Number(s.precio || 0) }));

      for (const servicio of serviciosRows) {
        if (!incluidos.includes(Number(servicio.idServicios))) {
          total += Number(servicio.precio || 0);
        }
      }
    }

    const habitacionPrincipal = asignadas[0];

    const resumenHabitaciones = asignadas.map((h, i) =>
      `${i + 1}: ${h.cantidadHabitaciones} x ${h.tipo} (${h.personasAsignadas} huésped(es))`
    ).join(', ');

    const descripcion = [
      `Huéspedes: ${cantidad}`,
      paqueteNombre ? `Paquete: ${paqueteNombre}` : 'Sin paquete',
      `Habitaciones: ${resumenHabitaciones}`,
      paquete ? `Excedente mejora: ${excedenteMejora}` : '',
      paquete && cargoHabitacionesExtra
        ? `Habitaciones adicionales: ${cargoHabitacionesExtra}`
        : '',
      nombresServicios.length
        ? `Servicios: ${nombresServicios.join(', ')}`
        : 'Sin servicios adicionales'
    ].filter(Boolean).join(' | ');

    archivoComprobante = leerComprobanteBase64(comprobantePago);

    if (archivoComprobante) {
      archivoComprobante.filename =
        `${crypto.randomUUID()}-${archivoComprobante.filename}`;

      fs.writeFileSync(
        path.join(carpetaComprobantes, archivoComprobante.filename),
        archivoComprobante.buffer
      );
    }

    const estadoPago = metodoPago === 'Transferencia' ? 'Pendiente de verificación' : 'Pendiente de confirmación en recepción';

    const [insert] = await connection.query(`
      INSERT INTO reservas (
        idClientesFK,
        idHabitacionesFK,
        idPaquetesFK,
        descripcion,
        fechaInicio,
        fechaFin,
        estado,
        total,
        horaLlegada,
        horaSalida,
        metodoPago,
        estadoPago,
        fechaPago,
        comprobantePago,
        reservadoPorNombre,
        reservadoPorEmail,
        idSedeFK
      )
      VALUES (?, ?, ?, ?, ?, ?, 'Pendiente', ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
    `, [
      usuario.idClientesFK,
      habitacionPrincipal.idHabitaciones,
      idPaquetesFK || null,
      descripcion,
      fechaInicio,
      fechaFin,
      total,
      horaLlegada,
      horaSalida,
      metodoPago,
      estadoPago,
      archivoComprobante
        ? `uploads/comprobantes/${archivoComprobante.filename}`
        : null,
      nombreCliente,
      emailCliente,
      idSedeFK || null
    ]);

    reservationId = insert.insertId;

    codigoReserva =
      `LUN-${new Date().getFullYear()}-${String(reservationId).padStart(6, '0')}`;

    await connection.query(
      'UPDATE reservas SET codigoReserva = ? WHERE idReservas = ?',
      [codigoReserva, reservationId]
    );

    for (const h of asignadas) {
      const cargoPorNoche =
        paquete && h.incluida
          ? Math.max(
              0,
              Number(h.precio || 0) - Number(paquete.precioHabitacionBase || 0)
            ) +
            Number(h.precio || 0) * Math.max(0, h.cantidadHabitaciones - 1)
          : Number(h.precio || 0) * h.cantidadHabitaciones;

      await connection.query(`
        INSERT INTO reservas_has_habitaciones (
          idReservasFK,
          idHabitacionesFK,
          personasAsignadas,
          cantidadHabitaciones,
          esHabitacionIncluida,
          cargoPorNoche
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        reservationId,
        h.idHabitaciones,
        h.personasAsignadas,
        h.cantidadHabitaciones,
        h.incluida ? 1 : 0,
        cargoPorNoche
      ]);
    }

    await asignarUnidadesFisicas(
      connection,
      reservationId,
      asignadas.map(h => ({
        idHabitaciones: h.idHabitaciones,
        tipo: h.tipo,
        cantidadHabitaciones: h.cantidadHabitaciones
      })),
      fechaInicio,
      fechaFin,
      null,
      idSedeFK
    );

    // CORRECCIÓN: se consulta también idUnidad para utilizarlo en la respuesta y el correo.
    [numerosAsignados] = await connection.query(`
      SELECT u.idUnidad, u.numeroHabitacion
      FROM reservas_has_unidades ru
      JOIN habitaciones_unidades u ON u.idUnidad = ru.idUnidadFK
      WHERE ru.idReservasFK = ?
      ORDER BY CAST(u.numeroHabitacion AS UNSIGNED)
    `, [reservationId]);

    await connection.commit();

    detalleCorreo = {
      habitaciones: asignadas.map(h =>
        `${h.cantidadHabitaciones} x ${h.tipo} (${h.personasAsignadas} huésped(es))`
      ),
      habitacionesFisicas: (numerosAsignados || []).map(
        x => `Hab. ${x.numeroHabitacion}`
      ),
      paquete: paqueteNombre,
      servicios: nombresServicios,
      llegada: fechaInicio,
      salida: fechaFin,
      horaLlegada,
      horaSalida,
      personas: cantidad,
      total,
      sede: ciudadSedeReserva,
      metodoPago,
      estadoPago
    };

  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // La transacción ya pudo haber finalizado.
    }

    console.error('Error creando reserva de huésped:', error);

    return res.status(500).json({
      mensaje: 'No se pudo registrar la reserva. Verifica que hayas ejecutado la migración de reservas con varias habitaciones.'
    });

  } finally {
    connection.release();
  }

  let emailEnviado = false;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM
  } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS && emailCliente) {
    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT || 456),
        secure: String(SMTP_SECURE || 'true').toLowerCase() === 'true',
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      });

      const lineas = [
        `Hola ${nombreCliente},`,
        '',
        `Registramos tu solicitud de reserva ${codigoReserva} en Hotel Lunaria.`,
        `Estado actual: ${estadoReserva}.`,
        `Habitaciones asignadas: ${detalleCorreo.habitaciones.join('; ')}.`,
        `Habitaciones: ${detalleCorreo.habitacionesFisicas.join('; ') || 'Por asignar'}.`,
        `Llegada: ${detalleCorreo.llegada} a las ${detalleCorreo.horaLlegada}.`,
        `Salida: ${detalleCorreo.salida} a las ${detalleCorreo.horaSalida}.`,
        `Método de pago: ${detalleCorreo.metodoPago}.`,
        `Estado del pago: ${detalleCorreo.estadoPago}.`,
        `Fecha del pago: Pendiente / no registrado.`,
        `Reserva realizada por: ${nombreCliente} (${emailCliente}).`,
        `Correo enviado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}.`,
        `Huéspedes: ${detalleCorreo.personas}.`,
        `Paquete: ${detalleCorreo.paquete || 'No seleccionado'}.`,
        `Sede: ${detalleCorreo.sede || 'Sede principal'}.`,
        `Servicios adicionales: ${detalleCorreo.servicios.length ? detalleCorreo.servicios.join(', ') : 'Ninguno'}.`,
        `Total estimado: ${Number(detalleCorreo.total).toLocaleString('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0
        })}.`,
        '',
        'Esta solicitud queda pendiente hasta que el hotel confirme la reserva.'
      ].join('\n');

      await transporter.sendMail({
        from: SMTP_FROM || SMTP_USER,
        to: emailCliente,
        subject: `Hotel Lunaria: ${codigoReserva} — ${estadoReserva}`,
        text: lineas,
        attachments: [
          {
            filename: `${codigoReserva}.pdf`,
            content: crearPdfReserva({
              id: reservationId,
              codigo: codigoReserva,
              nombre: nombreCliente,
              email: emailCliente,
              estado: estadoReserva,
              estadoPago: detalleCorreo.estadoPago,
              fechaEmision: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
              fechaPago: null,
              metodoPago,
              fechaInicio,
              fechaFin,
              horaLlegada,
              horaSalida,
              habitaciones: detalleCorreo.habitacionesFisicas.join('; ') || detalleCorreo.habitaciones.join('; '),
              servicios: serviciosPDF,
              paquete: detalleCorreo.paquete,
              sede: detalleCorreo.sede,
              total,
              reservadoPor: nombreCliente,
              emailReserva: emailCliente
            })
          }
        ].concat(
          archivoComprobante
            ? [{
                filename: archivoComprobante.filename,
                content: archivoComprobante.buffer,
                contentType: archivoComprobante.mimetype
              }]
            : []
        )
      });

      emailEnviado = true;

      await db.query(
        'UPDATE reservas SET fechaEnvioCorreo = NOW() WHERE idReservas = ?',
        [reservationId]
      );

      console.log('Correo de reserva enviado correctamente a:', emailCliente);

    } catch (error) {
      console.error('No se pudo enviar el correo de reserva:', error);
    }

  } else {
    console.error('No se envió el correo. Verifica:', {
      hostConfigurado: Boolean(SMTP_HOST),
      usuarioConfigurado: Boolean(SMTP_USER),
      contrasenaConfigurada: Boolean(SMTP_PASS),
      correoClienteConfigurado: Boolean(emailCliente)
    });
  }

  return res.status(201).json({
    mensaje: 'Reserva registrada.',
    idReservas: reservationId,
    codigoReserva,
    estado: estadoReserva,
    metodoPago,
    estadoPago: detalleCorreo.estadoPago,
    total,
    habitacionesAsignadas: detalleCorreo.habitaciones,
    numerosHabitacion: (numerosAsignados || []).map(x => x.numeroHabitacion),
    habitacionesFisicas: (numerosAsignados || []).map(x => ({
      idUnidad: x.idUnidad,
      numeroHabitacion: x.numeroHabitacion
    })),
    emailEnviado
  });
});

// Confirmación/rechazo de pagos presenciales o revisión de transferencias.
app.patch('/api/reservas/:id/pago', exigirToken, exigirModulo('reservas'), async (req, res) => {
  const id = Number(req.params.id);
  const accion = String(req.body?.accion || '').toLowerCase();
  const observacion = String(req.body?.observacion || '').trim();
  if (!Number.isInteger(id) || id <= 0 || !['aprobar', 'rechazar'].includes(accion)) {
    return res.status(400).json({ mensaje: 'Solicitud de actualización de pago no válida.' });
  }
  try {
    const [roles] = await db.query('SELECT nomRol, Estado FROM roles WHERE idRoles=? LIMIT 1', [req.sesion.idRolesFK]);
    const rol = normalizarPermiso(roles[0]?.nomRol || '');
    if (!roles.length || Number(roles[0].Estado) !== 1 || !['administrador','admin','gerente','recepcionista','superadmin'].includes(rol)) {
      return res.status(403).json({ mensaje: 'Solo administración, gerencia y recepción pueden gestionar pagos.' });
    }
    const [rows] = await db.query(`SELECT r.*, c.Nombre AS NombreCliente, c.Email AS EmailCliente,
      h.tipo AS Habitacion, p.nomPaquete AS Paquete, s.ciudad AS CiudadSede
      FROM reservas r LEFT JOIN clientes c ON c.idClientes=r.idClientesFK
      LEFT JOIN habitaciones h ON h.idHabitaciones=r.idHabitacionesFK
      LEFT JOIN paquetes p ON p.idPaquetes=r.idPaquetesFK
      LEFT JOIN sedes s ON s.idSedes=r.idSedeFK WHERE r.idReservas=? LIMIT 1`, [id]);
    if (!rows.length) return res.status(404).json({ mensaje: 'No se encontró la reserva.' });
    const reserva = rows[0];
    if (String(reserva.estadoPago || '').toLowerCase().includes('pagado') || String(reserva.estadoPago || '').toLowerCase() === 'aprobado') {
      return res.status(409).json({ mensaje: 'Este pago ya fue confirmado.' });
    }
    if (accion === 'aprobar' && reserva.metodoPago === 'Transferencia' && !reserva.comprobantePago) {
      return res.status(400).json({ mensaje: 'No hay comprobante de transferencia adjunto para revisar.' });
    }
    const estadoPago = accion === 'aprobar' ? 'Pagado' : 'Rechazado';
    const fechaPago = accion === 'aprobar' ? new Date() : null;
    await db.query('UPDATE reservas SET estadoPago=?, fechaPago=?, observacionPago=? WHERE idReservas=?',
      [estadoPago, fechaPago, observacion || null, id]);

    let emailEnviado = false;
    const mailer = crearTransportadorCorreo();
    if (mailer && reserva.EmailCliente) {
      try {
        const [fisicas] = await db.query(`SELECT u.numeroHabitacion FROM reservas_has_unidades ru JOIN habitaciones_unidades u ON u.idUnidad=ru.idUnidadFK WHERE ru.idReservasFK=? ORDER BY CAST(u.numeroHabitacion AS UNSIGNED)`, [id]);
        const [serviciosReserva] = await db.query(`SELECT s.nombre,s.precio FROM reservas_has_servicios rs JOIN servicios s ON s.idServicios=rs.Servicios_idServicios WHERE rs.Reservas_idReservas=? ORDER BY s.nombre`, [id]);
        const fechaActual = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
        const pdf = crearPdfReserva({ codigo: reserva.codigoReserva || `LUN-${id}`, nombre: reserva.NombreCliente,
          email: reserva.EmailCliente, estado: reserva.estado, estadoPago,
          fechaEmision: fechaActual, fechaPago: accion === 'aprobar' ? fechaActual : null,
          metodoPago: reserva.metodoPago, fechaInicio: reserva.fechaInicio, fechaFin: reserva.fechaFin,
          horaLlegada: reserva.horaLlegada, horaSalida: reserva.horaSalida,
          habitaciones: fisicas.map(x => `Hab. ${x.numeroHabitacion}`).join(', ') || reserva.Habitacion,
          servicios: serviciosReserva, paquete: reserva.Paquete || 'No aplica', sede: reserva.CiudadSede || 'Sede principal', total: reserva.total });
        const aprobado = accion === 'aprobar';
        await mailer.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: reserva.EmailCliente,
          subject: aprobado ? `Hotel Lunaria: pago confirmado — ${reserva.codigoReserva}` : `Hotel Lunaria: pago rechazado — ${reserva.codigoReserva}`,
          text: aprobado
            ? `Hola ${reserva.NombreCliente || ''},\nConfirmamos que recibimos tu pago de ${Number(reserva.total || 0).toLocaleString('es-CO')} COP para la reserva ${reserva.codigoReserva}.\nMétodo: ${reserva.metodoPago}.\nFecha de confirmación: ${fechaActual}.\nAdjuntamos tu comprobante actualizado. Gracias por elegir Hotel Lunaria.`
            : `Hola ${reserva.NombreCliente || ''},\nNo fue posible aprobar el pago de tu reserva ${reserva.codigoReserva}.\nMotivo/observación: ${observacion || 'Comunícate con recepción para recibir más información.'}\nLa reserva conserva su estado actual.`,
          attachments: aprobado ? [{ filename: `${reserva.codigoReserva || `LUN-${id}`}-pago-confirmado.pdf`, content: pdf, contentType: 'application/pdf' }] : []
        });
        emailEnviado = true;
      } catch (mailError) {
        console.error('El pago se actualizó, pero no se pudo enviar el correo:', mailError);
      }
    }
    return res.json({ mensaje: accion === 'aprobar' ? 'Pago confirmado correctamente.' : 'Pago marcado como rechazado.', estadoPago, emailEnviado });
  } catch (error) {
    console.error('Error gestionando pago:', error);
    return res.status(500).json({ mensaje: 'No se pudo actualizar el pago. Verifica que exista la columna observacionPago en reservas.' });
  }
});

// Entrega el comprobante de transferencia solo a personal autorizado con sesión válida.
app.get('/api/reservas/:id/comprobante', exigirToken, exigirModulo('reservas'), async (req, res) => {
  try {
    const idReserva = Number(req.params.id);
    if (!Number.isInteger(idReserva) || idReserva <= 0) {
      return res.status(400).json({ mensaje: 'El número de reserva no es válido.' });
    }
    const [rows] = await db.query(
      'SELECT comprobantePago FROM reservas WHERE idReservas=? LIMIT 1',
      [idReserva]
    );
    if (!rows.length || !rows[0].comprobantePago) {
      return res.status(404).json({ mensaje: 'Esta reserva no tiene un comprobante de transferencia adjunto.' });
    }

    // La BD puede contener una ruta relativa, una ruta antigua con barras o una ruta absoluta.
    const rutaGuardada = String(rows[0].comprobantePago).trim();
    const nombre = path.basename(rutaGuardada.replace(/\\/g, '/'));
    if (!nombre || nombre === '.' || nombre === '..') {
      return res.status(404).json({ mensaje: 'La ruta guardada del comprobante no es válida. Solicita que el cliente lo adjunte nuevamente.' });
    }

    const posiblesRutas = [
      path.join(carpetaComprobantes, nombre),
      path.join(__dirname, 'uploads', nombre),
      path.resolve(__dirname, rutaGuardada)
    ];
    const archivo = posiblesRutas.find(ruta => {
      try { return fs.existsSync(ruta) && fs.statSync(ruta).isFile(); }
      catch { return false; }
    });

    if (!archivo) {
      console.error(`Comprobante no encontrado para reserva ${idReserva}. Ruta BD: ${rutaGuardada}`);
      return res.status(404).json({
        mensaje: 'El archivo del comprobante no está en el servidor. La reserva conserva el registro, pero el cliente debe volver a adjuntar el soporte de pago.'
      });
    }

    const extension = path.extname(archivo).toLowerCase();
    const tipos = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
    res.setHeader('Content-Type', tipos[extension] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${nombre.replace(/["\\\\]/g, '')}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(archivo);
  } catch (error) {
    console.error('Error abriendo comprobante:', error);
    return res.status(500).json({ mensaje: 'No se pudo abrir el comprobante por un error del servidor.' });
  }
});

app.get('/api/reservas', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT r.*, c.Nombre AS NombreCliente, c.Email AS EmailCliente, h.tipo AS Habitacion, p.nomPaquete AS Paquete, s.ciudad AS CiudadSede,
      (SELECT GROUP_CONCAT(CONCAT(rh.cantidadHabitaciones, ' x ', h2.tipo) ORDER BY h2.tipo SEPARATOR ', ')
       FROM reservas_has_habitaciones rh JOIN habitaciones h2 ON h2.idHabitaciones = rh.idHabitacionesFK
       WHERE rh.idReservasFK = r.idReservas) AS HabitacionesAsignadas,
      (SELECT GROUP_CONCAT(u.numeroHabitacion ORDER BY CAST(u.numeroHabitacion AS UNSIGNED) SEPARATOR ', ')
       FROM reservas_has_unidades ru JOIN habitaciones_unidades u ON u.idUnidad=ru.idUnidadFK
       WHERE ru.idReservasFK=r.idReservas) AS NumerosHabitacion,
      (SELECT GROUP_CONCAT(CONCAT(u.idUnidad, ':', u.numeroHabitacion) ORDER BY CAST(u.numeroHabitacion AS UNSIGNED) SEPARATOR '|')
       FROM reservas_has_unidades ru JOIN habitaciones_unidades u ON u.idUnidad=ru.idUnidadFK
       WHERE ru.idReservasFK=r.idReservas) AS HabitacionesFisicasDetalle,
      (SELECT GROUP_CONCAT(rhs.Servicios_idServicios)
       FROM reservas_has_servicios rhs WHERE rhs.Reservas_idReservas = r.idReservas) AS serviciosSeleccionadosIds
      FROM reservas r LEFT JOIN clientes c ON c.idClientes = r.idClientesFK
      LEFT JOIN habitaciones h ON h.idHabitaciones = r.idHabitacionesFK
      LEFT JOIN paquetes p ON p.idPaquetes = r.idPaquetesFK
      LEFT JOIN sedes s ON s.idSedes=r.idSedeFK ORDER BY r.idReservas DESC`);
    res.json(rows.map(row => ({
      ...row,
      serviciosSeleccionados: row.serviciosSeleccionadosIds
        ? row.serviciosSeleccionadosIds.split(',').map(Number)
        : [],
      habitacionesFisicas: row.HabitacionesFisicasDetalle
        ? row.HabitacionesFisicasDetalle.split('|').map((item) => {
            const [idUnidad, numeroHabitacion] = item.split(':');
            return { idUnidad: Number(idUnidad), numeroHabitacion };
          })
        : []
    })));
  } catch (error) {
    console.error('Error al consultar reservas:', error);
    res.status(500).json({ mensaje: 'No se pudieron consultar las reservas.' });
  }
});

app.post('/api/reservas', async (req, res) => {
  let {
    idClientesFK, idHabitacionesFK, idPaquetesFK, idSedeFK = null, descripcion,
    fechaInicio, fechaFin, estado, total, serviciosSeleccionados = [], habitacionesSeleccionadas = [], personas = 1, horaLlegada = '15:00', horaSalida = '12:00', metodoPago = 'Efectivo', comprobantePago = null
  } = req.body || {};

  if (!['Efectivo','Tarjeta','Transferencia'].includes(metodoPago)) return res.status(400).json({ error: 'Método de pago no válido.' });
  if (metodoPago === 'Transferencia' && !comprobantePago) return res.status(400).json({ error: 'Adjunta el comprobante de transferencia.' });
  if (!idClientesFK) return res.status(400).json({ error: 'El cliente es obligatorio para registrar la reserva.' });
  if (fechaInicio && fechaFin && new Date(fechaFin) <= new Date(fechaInicio)) {
    return res.status(400).json({ error: 'La fecha final debe ser posterior a la fecha inicial.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    let habitacionFinal = idHabitacionesFK || null;
    if (idPaquetesFK) {
      const [paquetesRows] = await connection.query(
        'SELECT idHabitacionesFK,idSedeFK FROM paquetes WHERE idPaquetes = ? LIMIT 1', [idPaquetesFK]
      );
      if (!paquetesRows.length) throw new Error('El paquete seleccionado no existe.');
      if (!paquetesRows[0].idHabitacionesFK) throw new Error('El paquete no tiene una habitación incluida configurada. Ve a Gestión de Paquetes y asígnale una habitación.');
      habitacionFinal = paquetesRows[0].idHabitacionesFK;
      idSedeFK = paquetesRows[0].idSedeFK || idSedeFK;
    }
    if (!habitacionesSeleccionadas.length) {
      habitacionesSeleccionadas = await elegirHabitacionesPorCapacidad(
        connection, fechaInicio, fechaFin, personas, habitacionFinal, idPaquetesFK, idSedeFK
      );
    }
    await validarDisponibilidadHabitacion(connection, habitacionFinal, fechaInicio, fechaFin, null, idSedeFK);
    const archivoComprobanteAdmin = leerComprobanteBase64(comprobantePago);
    if (archivoComprobanteAdmin) { archivoComprobanteAdmin.filename = `${crypto.randomUUID()}-${archivoComprobanteAdmin.filename}`; fs.writeFileSync(path.join(carpetaComprobantes, archivoComprobanteAdmin.filename), archivoComprobanteAdmin.buffer); }
    const [result] = await connection.query(
      `INSERT INTO reservas (idClientesFK, idHabitacionesFK, idPaquetesFK, descripcion, fechaInicio, fechaFin, estado, total, horaLlegada, horaSalida, metodoPago, estadoPago, idSedeFK, comprobantePago)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idClientesFK, habitacionFinal, idPaquetesFK || null, descripcion || '', fechaInicio || null,
       fechaFin || null, estado || 'Pendiente', Number(total) || 0, horaLlegada, horaSalida, metodoPago,
       metodoPago === 'Transferencia' ? 'Pendiente de verificación' : 'Pendiente de confirmación en recepción', idSedeFK || null, archivoComprobanteAdmin ? `uploads/comprobantes/${archivoComprobanteAdmin.filename}` : null]
    );
    const reservaId = result.insertId;
    const codigoReserva = `LUN-${new Date().getFullYear()}-${String(reservaId).padStart(6, '0')}`;
    await connection.query('UPDATE reservas SET codigoReserva=?, reservadoPorNombre=?, reservadoPorEmail=? WHERE idReservas=?', [codigoReserva, req.sesion?.Nombre || 'Personal del hotel', req.sesion?.Email || null, reservaId]);
    let gruposFisicos = Array.isArray(habitacionesSeleccionadas) && habitacionesSeleccionadas.length
      ? habitacionesSeleccionadas.map(x => ({ idHabitaciones: Number(x.idHabitacionesFK ?? x.idHabitaciones), cantidadHabitaciones: Number(x.cantidadHabitaciones || 1), tipo: x.tipo }))
      : (habitacionFinal ? [{ idHabitaciones: Number(habitacionFinal), cantidadHabitaciones: 1 }] : []);
    if (idPaquetesFK && !gruposFisicos.some(g => Number(g.idHabitaciones) === Number(habitacionFinal))) {
      gruposFisicos.unshift({ idHabitaciones: Number(habitacionFinal), cantidadHabitaciones: 1, tipo: 'Habitación incluida' });
    }
    if (gruposFisicos.length) {
      await asignarUnidadesFisicas(connection, reservaId, gruposFisicos, fechaInicio, fechaFin, null, idSedeFK);
      for (const grupo of gruposFisicos) {
        const incluida = Boolean(idPaquetesFK) && Number(grupo.idHabitaciones) === Number(habitacionFinal);
        const [precioGrupo] = await connection.query('SELECT precio FROM habitaciones WHERE idHabitaciones=?', [grupo.idHabitaciones]);
        const cargoNoche = (Number(precioGrupo[0]?.precio) || 0) *
          (incluida ? Math.max(0, Number(grupo.cantidadHabitaciones) - 1) : Number(grupo.cantidadHabitaciones));
        await connection.query(`INSERT INTO reservas_has_habitaciones
          (idReservasFK,idHabitacionesFK,personasAsignadas,cantidadHabitaciones,esHabitacionIncluida,cargoPorNoche)
          VALUES (?,?,?,?,?,?)`,
          [reservaId, grupo.idHabitaciones, 1, grupo.cantidadHabitaciones, incluida ? 1 : 0, cargoNoche]);
      }
    }
    const ids = [...new Set((Array.isArray(serviciosSeleccionados) ? serviciosSeleccionados : [])
      .map(Number).filter(id => Number.isInteger(id) && id > 0))];
    let incluidos = [];
    if (idPaquetesFK) {
      const [rowsIncluidos] = await connection.query(
        'SELECT servicios_idServicios FROM servicios_has_paquetes WHERE Paquetes_idPaquetes = ?', [idPaquetesFK]
      );
      incluidos = rowsIncluidos.map(row => Number(row.servicios_idServicios));
    }
    for (const servicioId of ids.filter(id => !incluidos.includes(id))) {
      await connection.query(
        'INSERT IGNORE INTO reservas_has_servicios (Reservas_idReservas, Servicios_idServicios) VALUES (?, ?)',
        [reservaId, servicioId]
      );
    }
    const totalCalculado = await calcularTotalDesdeInventario(connection, gruposFisicos, idPaquetesFK, ids, fechaInicio, fechaFin);
    await connection.query('UPDATE reservas SET total = ? WHERE idReservas = ?', [totalCalculado, reservaId]);
    await connection.commit();
    let emailEnviado = false;
    try {
      const [[cliente]] = await db.query('SELECT Nombre,Email FROM clientes WHERE idClientes=? LIMIT 1', [idClientesFK]);
      const [[creador]] = await db.query('SELECT Nombre,Email FROM usuarios WHERE idUsuarios=? LIMIT 1', [req.sesion?.idUsuarios]);
      const [[sedeReserva]] = await db.query('SELECT ciudad FROM sedes WHERE idSedes=? LIMIT 1', [idSedeFK || 1]);
      const [[paquetePDF]] = idPaquetesFK ? await db.query('SELECT nomPaquete FROM paquetes WHERE idPaquetes=? LIMIT 1', [idPaquetesFK]) : [null];
      const [fisicas] = await db.query(`SELECT u.numeroHabitacion FROM reservas_has_unidades ru JOIN habitaciones_unidades u ON u.idUnidad=ru.idUnidadFK WHERE ru.idReservasFK=? ORDER BY CAST(u.numeroHabitacion AS UNSIGNED)`, [reservaId]);
      const [serviciosReserva] = await db.query(`SELECT s.nombre,s.precio FROM reservas_has_servicios rs JOIN servicios s ON s.idServicios=rs.Servicios_idServicios WHERE rs.Reservas_idReservas=? ORDER BY s.nombre`, [reservaId]);
      const mailer = crearTransportadorCorreo();
      if (mailer && cliente?.Email) {
        const fechaEnvio = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
        await mailer.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER, to: cliente.Email,
          subject: `Hotel Lunaria: ${codigoReserva} — ${estado || 'Pendiente'}`,
          text: `Hola ${cliente.Nombre || ''},\nTu reserva ${codigoReserva} fue registrada por ${creador?.Nombre || 'el personal del hotel'} (${creador?.Email || 'correo no disponible'}).\nSede: ${sedeReserva?.ciudad || 'Sede principal'}.\nEstado: ${estado || 'Pendiente'}.\nPago: ${metodoPago}; estado del pago: ${metodoPago === 'Transferencia' ? 'Pendiente de verificación' : 'Pendiente de confirmación en recepción'}.\nLlegada: ${fechaInicio} ${horaLlegada}. Salida: ${fechaFin} ${horaSalida}.\nHabitaciones: ${fisicas.map(x => x.numeroHabitacion).join(', ') || 'Por asignar'}.\nTotal: ${Number(totalCalculado).toLocaleString('es-CO')} COP.\nCorreo enviado: ${fechaEnvio}.`,
          attachments: [{ filename: `${codigoReserva}.pdf`, content: crearPdfReserva({ codigo: codigoReserva, nombre: cliente.Nombre, email: cliente.Email, estado: estado || 'Pendiente', estadoPago: metodoPago === 'Transferencia' ? 'Pendiente de verificación' : 'Pendiente de confirmación en recepción', fechaEmision: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }), fechaPago: 'Pendiente / no registrado', metodoPago, fechaInicio, fechaFin, horaLlegada, horaSalida, sede: sedeReserva?.ciudad || 'Sede principal', habitaciones: fisicas.map(x => `Hab. ${x.numeroHabitacion}`).join(', '), servicios: serviciosReserva, paquete: paquetePDF?.nomPaquete || 'No aplica', total: totalCalculado, reservadoPor: creador?.Nombre || 'Personal del hotel', emailReserva: creador?.Email || '' }) }].concat(archivoComprobanteAdmin ? [{ filename: archivoComprobanteAdmin.filename, content: archivoComprobanteAdmin.buffer, contentType: archivoComprobanteAdmin.mimetype }] : [])
        });
        emailEnviado = true;
        await db.query('UPDATE reservas SET fechaEnvioCorreo=NOW() WHERE idReservas=?', [reservaId]);
      }
    } catch (mailError) { console.error('Reserva guardada, pero falló el correo administrativo:', mailError); }
    return res.status(201).json({ message: 'Reserva creada con éxito.', idReservas: reservaId, codigoReserva, emailEnviado });
  } catch (err) {
    await connection.rollback();
    console.error('Error al crear reserva:', err);
    return res.status(400).json({ error: err.message || 'Error al registrar la reserva en la base de datos.' });
  } finally { connection.release(); }
});

app.put('/api/reservas/:id', async (req, res) => {
  let { id } = req.params;
  const {
    idClientesFK, idHabitacionesFK, idPaquetesFK, descripcion,
    fechaInicio, fechaFin, estado, total, serviciosSeleccionados = [], habitacionesSeleccionadas = [], personas = 1, horaLlegada = '15:00', horaSalida = '12:00', metodoPago = 'Efectivo', estadoPago
  } = req.body || {};
  if (!idClientesFK) return res.status(400).json({ error: 'El cliente es obligatorio para actualizar la reserva.' });
  if (fechaInicio && fechaFin && new Date(fechaFin) <= new Date(fechaInicio)) {
    return res.status(400).json({ error: 'La fecha final debe ser posterior a la fecha inicial.' });
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    let habitacionFinal = idHabitacionesFK || null;
    let sedeFinal = req.body.idSedeFK || null;
    if (idPaquetesFK) {
      const [paquetesRows] = await connection.query(
        'SELECT idHabitacionesFK,idSedeFK FROM paquetes WHERE idPaquetes = ? LIMIT 1', [idPaquetesFK]
      );
      if (!paquetesRows.length) throw new Error('El paquete seleccionado no existe.');
      if (!paquetesRows[0].idHabitacionesFK) throw new Error('El paquete no tiene una habitación incluida configurada.');
      habitacionFinal = paquetesRows[0].idHabitacionesFK;
      sedeFinal = paquetesRows[0].idSedeFK || sedeFinal;
    }
    await validarDisponibilidadHabitacion(connection, habitacionFinal, fechaInicio, fechaFin, id, sedeFinal);
    const [result] = await connection.query(
      `UPDATE reservas SET idClientesFK = ?, idHabitacionesFK = ?, idPaquetesFK = ?, descripcion = ?,
       fechaInicio = ?, fechaFin = ?, estado = ?, total = ?, horaLlegada=?, horaSalida=?, metodoPago=?, estadoPago=COALESCE(?,estadoPago), idSedeFK=? WHERE idReservas = ?`,
      [idClientesFK, habitacionFinal, idPaquetesFK || null, descripcion || '', fechaInicio || null,
       fechaFin || null, estado || 'Pendiente', Number(total) || 0, horaLlegada, horaSalida, metodoPago, estadoPago || null, sedeFinal, id]
    );
    if (!result.affectedRows) { await connection.rollback(); return res.status(404).json({ error: 'Reserva no encontrada para actualizar.' }); }
    const [anteriores] = await connection.query('SELECT idHabitacionesFK, cantidadHabitaciones FROM reservas_has_habitaciones WHERE idReservasFK = ?', [id]);
    let gruposFisicos = Array.isArray(habitacionesSeleccionadas) && habitacionesSeleccionadas.length
      ? habitacionesSeleccionadas.map(x => ({ idHabitaciones: Number(x.idHabitacionesFK ?? x.idHabitaciones), cantidadHabitaciones: Number(x.cantidadHabitaciones || 1), tipo: x.tipo }))
      : (anteriores.length
          ? anteriores.map(x => ({ idHabitaciones: Number(x.idHabitacionesFK), cantidadHabitaciones: Number(x.cantidadHabitaciones || 1) }))
          : (habitacionFinal ? [{ idHabitaciones: Number(habitacionFinal), cantidadHabitaciones: 1 }] : []));
    if (idPaquetesFK && !gruposFisicos.some(g => Number(g.idHabitaciones) === Number(habitacionFinal))) {
      gruposFisicos.unshift({ idHabitaciones: Number(habitacionFinal), cantidadHabitaciones: 1, tipo: 'Habitación incluida' });
    }
    await connection.query('DELETE FROM reservas_has_unidades WHERE idReservasFK = ?', [id]);
    await connection.query('DELETE FROM reservas_has_habitaciones WHERE idReservasFK = ?', [id]);
    if (gruposFisicos.length) {
      await asignarUnidadesFisicas(connection, Number(id), gruposFisicos, fechaInicio, fechaFin, Number(id), sedeFinal);
      for (const grupo of gruposFisicos) {
        const incluida = Boolean(idPaquetesFK) && Number(grupo.idHabitaciones) === Number(habitacionFinal);
        const [precioGrupo] = await connection.query('SELECT precio FROM habitaciones WHERE idHabitaciones=?', [grupo.idHabitaciones]);
        const cargoNoche = (Number(precioGrupo[0]?.precio) || 0) *
          (incluida ? Math.max(0, Number(grupo.cantidadHabitaciones) - 1) : Number(grupo.cantidadHabitaciones));
        await connection.query(`INSERT INTO reservas_has_habitaciones
          (idReservasFK,idHabitacionesFK,personasAsignadas,cantidadHabitaciones,esHabitacionIncluida,cargoPorNoche)
          VALUES (?,?,?,?,?,?)`,
          [id, grupo.idHabitaciones, 1, grupo.cantidadHabitaciones, incluida ? 1 : 0, cargoNoche]);
      }
    }
    await connection.query('DELETE FROM reservas_has_servicios WHERE Reservas_idReservas = ?', [id]);
    const ids = [...new Set((Array.isArray(serviciosSeleccionados) ? serviciosSeleccionados : [])
      .map(Number).filter(value => Number.isInteger(value) && value > 0))];
    let incluidos = [];
    if (idPaquetesFK) {
      const [rowsIncluidos] = await connection.query(
        'SELECT servicios_idServicios FROM servicios_has_paquetes WHERE Paquetes_idPaquetes = ?', [idPaquetesFK]
      );
      incluidos = rowsIncluidos.map(row => Number(row.servicios_idServicios));
    }
    for (const servicioId of ids.filter(value => !incluidos.includes(value))) {
      await connection.query(
        'INSERT IGNORE INTO reservas_has_servicios (Reservas_idReservas, Servicios_idServicios) VALUES (?, ?)',
        [id, servicioId]
      );
    }
    const totalCalculado = await calcularTotalDesdeInventario(connection, gruposFisicos, idPaquetesFK, ids, fechaInicio, fechaFin);
    await connection.query('UPDATE reservas SET total = ? WHERE idReservas = ?', [totalCalculado, id]);
    await connection.commit();
    return res.json({ message: 'Reserva actualizada correctamente.' });
  } catch (err) {
    await connection.rollback();
    console.error('Error al actualizar reserva:', err);
    return res.status(400).json({ error: err.message || 'Error al actualizar la reserva.' });
  } finally { connection.release(); }
});

app.delete('/api/reservas/:id', async (req, res) => {
  const { id } = req.params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [encontrada] = await connection.query(
      'SELECT idReservas FROM reservas WHERE idReservas = ? LIMIT 1 FOR UPDATE',
      [id]
    );
    if (!encontrada.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // Eliminar primero las relaciones dependientes para permitir borrar cualquier reserva.
    await connection.query('DELETE FROM reservas_has_unidades WHERE idReservasFK = ?', [id]);
    await connection.query(
      'DELETE FROM reservas_has_servicios WHERE Reservas_idReservas = ?',
      [id]
    );
    await connection.query(
      'DELETE FROM reservas_has_habitaciones WHERE idReservasFK = ?',
      [id]
    );
    const [result] = await connection.query(
      'DELETE FROM reservas WHERE idReservas = ?',
      [id]
    );

    await connection.commit();
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    res.json({ message: 'Reserva eliminada correctamente' });
  } catch (err) {
    await connection.rollback();
    console.error('Error al eliminar reserva:', err);
    res.status(500).json({ error: 'Error al eliminar la reserva.' });
  } finally {
    connection.release();
  }
});

// ==========================================
// RUTAS DE HUÉSPEDES
// ==========================================

app.get('/api/huespedes', async (req, res) => {
  try {
    const sql = `
      SELECT 
        h.idHuespedes,
        h.Nombre AS NombreHuesped,
        h.idClientesFK,
        c.Nombre AS NombreCliente
      FROM huespedes h
      LEFT JOIN clientes c ON h.idClientesFK = c.idClientes
    `;
    const [results] = await db.query(sql);
    res.json(results);
  } catch (err) {
    console.error('Error al obtener huéspedes:', err);
    res.status(500).json({ error: 'Error al consultar huéspedes' });
  }
});

app.post('/api/huespedes', async (req, res) => {
  const { Nombre, idClientesFK } = req.body;

  if (!Nombre || !idClientesFK) {
    return res.status(400).json({ error: 'El nombre del huésped y el cliente asociado son obligatorios' });
  }

  try {
    const sql = 'INSERT INTO huespedes (Nombre, idClientesFK) VALUES (?, ?)';
    const [result] = await db.query(sql, [Nombre, idClientesFK]);
    
    res.status(201).json({ 
      message: 'Huésped registrado con éxito', 
      idHuespedes: result.insertId 
    });
  } catch (err) {
    console.error('Error al crear huésped:', err);
    res.status(500).json({ error: 'Error al registrar el huésped en la base de datos' });
  }
});

app.put('/api/huespedes/:id', async (req, res) => {
  const { id } = req.params;
  const { Nombre, idClientesFK } = req.body;

  if (!Nombre || !idClientesFK) {
    return res.status(400).json({ error: 'El nombre y el cliente asociado son obligatorios' });
  }

  try {
    const sql = 'UPDATE huespedes SET Nombre = ?, idClientesFK = ? WHERE idHuespedes = ?';
    const [result] = await db.query(sql, [Nombre, idClientesFK, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Huésped no encontrado para actualizar' });
    }

    res.json({ message: 'Huésped actualizado correctamente' });
  } catch (err) {
    console.error('Error al actualizar huésped:', err);
    res.status(500).json({ error: 'Error al actualizar el huésped' });
  }
});

app.delete('/api/huespedes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const sql = 'DELETE FROM huespedes WHERE idHuespedes = ?';
    const [result] = await db.query(sql, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Huésped no encontrado' });
    }

    res.json({ message: 'Huésped eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar huésped:', err);
    res.status(500).json({ error: 'Error al eliminar huésped' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});