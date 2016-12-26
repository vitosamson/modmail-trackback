import http from 'http';
import Worker from './worker';

const requiredEnvVars = ['USER', 'PASS', 'APP_ID', 'APP_SECRET', 'SUBREDDIT', 'SUBMISSION_MATCH_PATTERN'];
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`Missing required ${envVar} environment variable`);
    process.exit(1);
  }
});

const interval = process.env.INTERVAL || 5;
const port = process.env.PORT || 5000;
const worker = new Worker();

/**
 * Provides a simple server that can be used to make sure the process is still running.
 */
function startServer() {
  const server = http.createServer((req, res) => {
    res.statusCode = 200; // eslint-disable-line no-param-reassign
    res.end();
  });
  server.listen(port);
  console.log('Server listening at', port);
}

/**
 * Runs the worker and then schedules it to be run again after the specified interval.
 */
function startWorker() {
  console.log(`Running every ${interval} minutes`);
  console.log('Running as user', process.env.USER);
  console.log('Working on subreddit', process.env.SUBREDDIT);
  console.log(`Using submission match pattern /${process.env.SUBMISSION_MATCH_PATTERN}/`);

  worker.run().catch(() => {}).then(() => setTimeout(startWorker, interval * 60 * 1000));
}

startServer();
startWorker();
