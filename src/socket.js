let io = null;

function init(server) {

  const { Server } = require('socket.io');

  io = new Server(server, {

    cors: {
      origin: '*'
    }

  });

  io.on('connection', (socket) => {

    console.log('Client connecté :', socket.id);

    socket.on('disconnect', () => {

      console.log('Client déconnecté :', socket.id);

    });

  });

}

function getIO() {

  if (!io) {
    throw new Error('Socket.IO non initialisé');
  }

  return io;

}

module.exports = {
  init,
  getIO
};