const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { startSimulation } = require('../api/simulationController');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

app.post('/api/run', async (req, res) => {
  return startSimulation(req, res, io);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'simulasinxron-web', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Web dashboard running at http://localhost:${PORT}`);
});

module.exports = { app, server, io };
