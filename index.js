require('babel-register');

const { startWorker, startServer } = require('./src');
startServer();
startWorker();
