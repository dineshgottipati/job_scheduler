import { WorkerEngine } from './worker.js';

async function main() {
  const engine = new WorkerEngine();

  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Initiating graceful shutdown...`);
    await engine.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await engine.start();
  } catch (err) {
    console.error('Fatal error starting worker engine:', err);
    process.exit(1);
  }
}

main();
