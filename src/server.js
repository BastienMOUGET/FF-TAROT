require('dotenv').config();

const http = require('http');

const app = require('./app');

const socket = require('./socket');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

socket.init(server);

server.listen(PORT, () => {

  console.log(`
=================================
 FFT TAROT API
=================================

 PORT : ${PORT}

 SOCKET.IO : ENABLED

=================================
`);

});