# Chat flotante con vistas alternables

## Alcance
El cambio afecta exclusivamente el modo compacto usado por `ChatBubble`. El panel principal de administración continúa usando el modo no compacto y conserva su distribución de lista e historial.

## Comportamiento
- Al abrir la burbuja, se muestra únicamente la lista de conversaciones a todo el ancho del widget.
- Al seleccionar un cliente, la lista se desmonta de la vista y aparece únicamente el historial de esa conversación, ocupando el ancho disponible.
- La cabecera de la conversación incorpora el botón `←` junto al nombre del cliente. Al pulsarlo se vuelve a la lista.
- Al cerrar y volver a abrir la burbuja, el componente se reinicia y presenta la lista principal.
- La caja de mensajes y el formulario permanecen dentro del ancho del widget, sin columnas laterales simultáneas.

## Archivos modificados
- `Lunaria/src/GestionComentarios.jsx`: estado local `vistaConversacion`, renderizado condicional de la lista o conversación y botón para regresar. La lógica de selección, carga, historial y envío se conserva.
- `Lunaria/src/ClienteHotel.css`: reglas nuevas bajo `.lunaria-chat-compact` para ocupar el 100% del widget en ambas vistas. No se modifican las reglas del panel administrativo sin esa clase.

## Validaciones
- Transpilación sintáctica de `GestionComentarios.jsx` y `ChatBubble.jsx` con TypeScript: 0 diagnósticos.
- Balance de llaves del CSS: correcto.
- Integridad del ZIP: comprobada con `unzip -t`.
- No se ejecutó `vite build` ni una prueba visual en navegador.
- No se modificó ningún archivo del backend ni configuración de entorno.
