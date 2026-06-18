import app from './app.js';
import { env } from './config/env.js';
import pool from './db/pool.js';
import { startUnverifiedAccountCleanupJob } from './services/unverifiedAccountCleanupService.js';

const ignoreClosedConsolePipe = (error) => {
  if (error?.code !== 'EOF' && error?.code !== 'EPIPE') {
    throw error;
  }
};

process.stdout.on('error', ignoreClosedConsolePipe);
process.stderr.on('error', ignoreClosedConsolePipe);
process.on('uncaughtException', (error) => {
  if (error?.code === 'EOF' || error?.code === 'EPIPE') {
    return;
  }

  console.error('Uncaught exception:', error);
  process.exit(1);
});

const startServer = async () => {
  try {
    await pool.query('SELECT 1');

    app.listen(env.port, () => {
      console.log(`Backend server is running on http://localhost:${env.port}`);
      startUnverifiedAccountCleanupJob();
    });
  } catch (error) {
    console.error('Failed to start the backend server:', error.message);
    process.exit(1);
  }
};

startServer();
