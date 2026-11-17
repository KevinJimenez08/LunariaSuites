# Hotel Lunaria – actualización de módulos

## Archivos entregados
- `backend/server.js`: endpoints, validaciones de fechas, permisos, cancelación, notificaciones, reseñas, informes, chat, galería y restablecimiento seguro.
- `backend/migrations_lunaria.sql`: tablas y columnas adicionales necesarias.
- `Lunaria/src/`: interfaces actualizadas y componentes nuevos.

## Instalación de base de datos
1. Importa primero el respaldo `Dump20261115.sql` en tu base de datos `lunaria`.
2. Ejecuta una sola vez `backend/migrations_lunaria.sql` sobre esa base.
3. Reinicia el backend.

La migración agrega notificaciones, reseñas, logs de seguridad, tokens de restablecimiento, galería de habitaciones, configuración pública y campos de estado/fecha de salida para huéspedes.

## Configuración bancaria y footer
No se proporcionó el número de cuenta real ni los datos de contacto del hotel, por lo que se dejaron vacíos deliberadamente y no se inventaron. Después de ejecutar la migración, registra los datos reales con consultas como:

```sql
UPDATE configuracion_hotel SET valor='BANCO REAL' WHERE clave='banco_transferencia';
UPDATE configuracion_hotel SET valor='TITULAR REAL' WHERE clave='titular_transferencia';
UPDATE configuracion_hotel SET valor='NUMERO DE CUENTA REAL' WHERE clave='cuenta_transferencia';
UPDATE configuracion_hotel SET valor='+57 300 000 0000' WHERE clave='telefono_contacto';
UPDATE configuracion_hotel SET valor='reservas@tudominio.com' WHERE clave='correo_contacto';
UPDATE configuracion_hotel SET valor='DIRECCION REAL' WHERE clave='direccion_contacto';
```

El IVA se inicializa en 19% y se puede ajustar en `configuracion_hotel` según la responsabilidad tributaria del establecimiento. El desglose de la factura se calcula como IVA incluido en el total; confirma el tratamiento tributario con tu contador antes de emitir facturas fiscales.

## Correo electrónico
Los correos de cancelación y los enlaces de creación/restablecimiento de contraseña requieren que el transporte SMTP existente esté configurado. No se modificó `backend/.env`. Para producción, define `FRONTEND_URL` en el entorno de ejecución para que los enlaces de restablecimiento apunten al dominio publicado; si no existe, se usa el origen de la solicitud o `http://localhost:5173`.

## Ejecución
En `backend/`:
```bash
npm install
npm start
```

En `Lunaria/`:
```bash
npm install
npm run dev
```

Para actualizar la versión de producción, ejecuta `npm run build` en `Lunaria/` y publica el nuevo directorio `dist/`.

## Roles iniciales del respaldo
- Gerente (ID 1): único con acceso a Roles e Informes.
- Administrador (ID 2): módulos operativos, sin Roles ni Informes.
- Recepcionista (ID 3): solo Huéspedes; puede crear y completar hospedajes cuando la fecha de salida ya llegó, sin editar ni eliminar.
- Cliente (ID 4): reservas, chat y reseñas propias.

## Validación realizada
- `node --check backend/server.js`: correcto.
- Análisis sintáctico JSX de los componentes: correcto.
- Resolución de imports locales: correcta.
- No se pudo ejecutar `npm run build` en este entorno porque `npm ci` no terminó al intentar descargar dependencias. Debes generar el `dist/` actualizado en tu equipo con `npm install && npm run build`.


## Ajustes adicionales de esta entrega
- La burbuja flotante de chat ahora también se muestra al personal de soporte y al personal administrativo autorizado; usa botón morado con icono y etiqueta “Soporte”.
- El panel de soporte muestra una bandeja de conversaciones con nombre y correo del cliente, último mensaje y selección directa del hilo. Las notificaciones de chat incluyen la identidad del cliente.
- La campana de notificaciones está integrada en la barra superior, inmediatamente junto al perfil.
- El módulo de informes permite consultar por mes o año e incluye reservas, ingresos, confirmaciones, cancelaciones y estimación de ocupación por sede.
- La acción de restablecimiento de contraseña del Gerente se representa con un icono de sobre morado y continúa enviando un enlace seguro por correo.

## Verificación de esta entrega
- `node --check backend/server.js`: correcto.
- Transpilación/sintaxis JSX de todos los componentes: correcta.
- No se modificó `backend/.env`; se verificó que conserva exactamente el mismo SHA-256 que el archivo original.
- No se ejecutó una prueba integrada contra MySQL ni un build de Vite en este entorno. Después de instalar dependencias, ejecuta `npm run build` desde `Lunaria/` y prueba los endpoints con la base migrada.
