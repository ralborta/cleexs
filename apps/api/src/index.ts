import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import tenantRoutes from './routes/tenants';
import brandRoutes from './routes/brands';
import promptRoutes from './routes/prompts';
import runRoutes from './routes/runs';
import reportRoutes from './routes/reports';

const server = Fastify({
  logger: true,
});

// Plugins
await server.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
});

await server.register(helmet);

// Health check
server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Routes
await server.register(tenantRoutes, { prefix: '/api/tenants' });
await server.register(brandRoutes, { prefix: '/api/brands' });
await server.register(promptRoutes, { prefix: '/api/prompts' });
await server.register(runRoutes, { prefix: '/api/runs' });
await server.register(reportRoutes, { prefix: '/api/reports' });

// Start server
const port = Number(process.env.API_PORT) || 3001;
const host = process.env.API_HOST || '0.0.0.0';

server.listen({ port, host }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 API server listening on ${address}`);
  console.log(`📚 API docs available at http://${address}/api`);
});
