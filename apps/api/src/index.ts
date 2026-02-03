import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import tenantRoutes from './routes/tenants';
import brandRoutes from './routes/brands';
import promptRoutes from './routes/prompts';
import runRoutes from './routes/runs';
import reportRoutes from './routes/reports';

async function bootstrap() {
  const server = Fastify({
    logger: true,
  });

  // Plugins
  const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  await server.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes('*')) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'), false);
    },
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
  const port = Number(process.env.PORT) || Number(process.env.API_PORT) || 3001;
  const host = process.env.API_HOST || '0.0.0.0';

  try {
    const address = await server.listen({ port, host });
    console.log(`🚀 API server listening on ${address}`);
    console.log(`📚 API docs available at ${address}/api`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
