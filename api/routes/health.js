import { Hono } from 'hono';

export const healthRoute = new Hono();

healthRoute.get('/health', (c) => {
  return c.json({
    success: true,
    status: 'ok',
    service: 'ai-gateway-2-of-10-provider-registry',
    timestamp: new Date().toISOString(),
  });
});
