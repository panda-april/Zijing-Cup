const express = require('express');
const cors = require('cors');
const { PORT } = require('./config');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/ping', (_req, res) => {
  res.send('紫荆杯后端服务已启动，Pong!');
});

// All API routes
app.use('/api', routes);

// Centralized error handler
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}

module.exports = app;
