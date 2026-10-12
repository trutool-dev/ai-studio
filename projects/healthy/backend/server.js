require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[server] Servidor corriendo en puerto ${PORT} — entorno: ${process.env.NODE_ENV}`);
});
