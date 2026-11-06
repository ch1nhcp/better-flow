import app from './app.js';
import { env } from './config/env.js';
import { closePool } from './db/pool.js';

const server = app.listen(env.PORT, () => {
  console.log(`Betterflow API listening on http://localhost:${env.PORT}`);
});

function shutdown() {
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  server.close(() => {
    void closePool().then(
      () => {
        clearTimeout(timeout);
        process.exit(0);
      },
      () => {
        process.exit(1);
      },
    );
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
