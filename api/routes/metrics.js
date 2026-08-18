import { Hono } from 'hono';
import { register } from '../lib/metrics.js';

export const metricsRoute = new Hono();

metricsRoute.get('/metrics', async (c) => {
  const body = await register.metrics();
  c.header('Content-Type', register.contentType);
  return c.body(body);
});
