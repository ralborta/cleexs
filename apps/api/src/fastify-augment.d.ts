import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Rellenado por fastify-raw-body cuando config.rawBody es true */
    rawBody?: string;
  }
}
