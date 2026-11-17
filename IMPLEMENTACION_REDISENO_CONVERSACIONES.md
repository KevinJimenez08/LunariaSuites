# Hotel Lunaria – rediseño de Conversaciones de clientes

## Cambios realizados
- Se reorganizó `GestionComentarios.jsx` para presentar la bandeja de clientes como una lista vertical compacta de filas horizontales.
- Cada fila muestra avatar con iniciales, nombre en negrita, extracto del último mensaje y fecha discreta alineada a la derecha.
- Las conversaciones se ordenan por la fecha del mensaje más reciente de cada cliente.
- Al seleccionar una fila, el panel principal muestra el historial completo del cliente seleccionado y mantiene el formulario para responder sin salir de la vista.
- Se agregó un estado vacío cuando aún no se ha seleccionado una conversación.
- El diseño es adaptable: en pantallas pequeñas, la bandeja queda encima del historial.
- Se conservaron los endpoints y el comportamiento de carga, actualización y envío de mensajes existentes.

## Archivos modificados
- `Lunaria/src/GestionComentarios.jsx`
- `Lunaria/src/ClienteHotel.css`

## Validaciones
- Transpilación JSX de `GestionComentarios.jsx`: cero diagnósticos.
- `backend/.env` se conservó sin cambios. SHA-256: `a7191138861b2863634218f053392d30745335cfe289553a2e681f2f4b43dcbd`.
- No se ejecutó `npm run build` ni pruebas de integración en navegador en este entorno; validar con dependencias instaladas y la API activa.
