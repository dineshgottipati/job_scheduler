import { buildServer } from './server.js';

async function main() {
  const port = parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || '0.0.0.0';

  const server = await buildServer();

  try {
    await server.listen({ port, host });
    console.log(`🚀 API Server running on http://${host}:${port}`);
    console.log(`📚 OpenAPI Docs available at http://${host}:${port}/documentation`);
    console.log(`🔌 WebSocket server active on ws://${host}:${port}/ws`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
