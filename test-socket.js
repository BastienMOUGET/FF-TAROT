const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {

  console.log('Connecté');

});

socket.on('ranking:update', (data) => {

  console.log('Classement MAJ :');

  console.log(JSON.stringify(data, null, 2));

});