import http from 'http';
import { run } from './worker';

if (!process.env.USER || !process.env.PASS || !process.env.APP_ID || !process.env.APP_SECRET) {
  console.error(`Missing USER, PASS, APP_ID or APP_SECRET env vars`);
  process.exit(1);
}

const interval = (process.env.INTERVAL || 5);
const port = process.env.PORT || 5000;

/**
 * Provides a simple server that can be used to make sure the process is still running.
 */
function startServer() {
  const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.end();
  });
  server.listen(port);
  console.log('Server listening at', port);
}

/**
 * Runs the worker and then schedules it to be run again after the specified interval.
 */
export function start() {
  console.log(`Running every ${interval} minutes`);
  startServer();
  run().catch(() => {}).then(() => setTimeout(start, interval * 60 * 1000));
}
