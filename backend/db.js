const mysql = require('mysql2/promise');

// Puedes definir estas variables en tu terminal antes de iniciar el backend.
// Si no las defines, se conservan los valores locales que ya usaba el proyecto.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? 'root',
  database: process.env.DB_NAME || 'lunaria',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
