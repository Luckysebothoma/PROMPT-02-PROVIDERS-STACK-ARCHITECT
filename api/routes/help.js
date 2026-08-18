import { Hono } from 'hono';

export const helpRoute = new Hono();

helpRoute.get('/help', (c) => {
  return c.json({
    success: true,
    service: 'ai-gateway-2-of-10-provider-registry',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Liveness check' },
      { method: 'GET', path: '/ready', description: 'Readiness check (DB connectivity)' },
      { method: 'GET', path: '/dependencies', description: 'Dependency + provider health diagnostics' },
      { method: 'GET', path: '/help', description: 'This endpoint' },
      { method: 'GET', path: '/metrics', description: 'Prometheus metrics' },
      { method: 'POST', path: '/v1/chat', description: 'Chat via resolved provider/model' },
    ],
  });
});
