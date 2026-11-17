# Ajuste del chat en la burbuja flotante

## Alcance
Se corrigió únicamente la presentación del chat cuando se abre desde la burbuja flotante de soporte. El panel principal de **Comentarios y soporte** conserva su diseño anterior.

## Cambios
- `Lunaria/src/ChatBubble.jsx`: identifica el renderizado flotante y activa el modo compacto mediante la propiedad `compact`.
- `Lunaria/src/GestionComentarios.jsx`: agrega una clase condicional `lunaria-chat-compact`; el comportamiento de carga, selección de clientes, historial y envío de mensajes se mantiene.
- `Lunaria/src/ClienteHotel.css`: añade reglas aisladas bajo `.lunaria-chat-compact` y `.lunaria-chat-popover`.
  - Ventana de ancho limitado y altura adaptable al viewport, con `overflow: hidden` en el contenedor para evitar que se expanda como una página.
  - Bandeja de clientes compacta con scroll vertical propio.
  - Área de conversación y formulario ajustados al espacio disponible.
  - En pantallas estrechas, la lista pasa arriba del historial para conservar el ancho útil.
  - No se modifican las reglas del panel administrativo sin la clase compacta.

## Validaciones realizadas
- Transpilación sintáctica de `ChatBubble.jsx` y `GestionComentarios.jsx` con TypeScript: 0 diagnósticos.
- Balance de llaves del CSS: correcto.
- Se verificó que `backend/.env` conserva exactamente su SHA-256 original: `a7191138861b2863634218f053392d30745335cfe289553a2e681f2f4b43dcbd`.
- No se ejecutó `vite build` ni una prueba visual en navegador en este entorno.

## Ajuste adicional de altura
- El recuadro de mensajes en la burbuja usa altura automática según su contenido y `max-height: 190px` con scroll vertical.
- El campo de respuesta compacto usa `rows={1}`, altura de `42px` y `resize: none`.
- Estas reglas continúan limitadas a `lunaria-chat-compact`; el panel administrativo principal no cambia.
