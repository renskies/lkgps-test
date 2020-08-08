const dotenv = require('dotenv');
const net = require('net');
const colors = require('colors');

// Load env vars
dotenv.config({ path: './config/config.env' });

const PORT = process.env.PORT || 5001;

const server = net.createServer((client) => {
  // 'connection' listener.
  console.log('client connected');

  client.on('data', (data) => {
    const buff = new Buffer(data, 'utf8');
    console.log(buff.toString('hex'));
  });
});

server.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold
  );
});
