import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { healthRoute } from './routes/health.js';
import { readyRoute } from './routes/ready.js';
import { dependenciesRoute } from './routes/dependencies.js';
import { helpRoute } from './routes/help.js';
import { metricsRoute } from './routes/metrics.js';
import { chatRoute } from './routes/chat.js';

import { getPool } from './db/client.js';
import { ProviderRegistry } from './providers/provider.registry.js';
import { ModelRegistry } from './providers/model.registry.js';
import { logger } from './lib/logger.js';

const app = new Hono();

const providerRegistry = new ProviderRegistry(process.env);
const modelRegistry = new ModelRegistry({
  db: getPool(),
  providerRegistry,
  env: process.env,
});

// Attach shared instances to context for route handlers.
app.use('*', async (c, next) => {
  c.set('providerRegistry', providerRegistry);
  c.set('modelRegistry', modelRegistry);
  await next();
});

app.route('/', healthRoute);
app.route('/', readyRoute);
app.route('/', dependenciesRoute);
app.route('/', helpRoute);
app.route('/', metricsRoute);
app.route('/', chatRoute);

app.onError((err, c) => {
  logger.error('unhandled error', { message: err.message });
  return c.json(
    {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    },
    500
  );
});

app.notFound((c) =>
  c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404)
);

const port = Number(process.env.PORT || 8080);

serve({ fetch: app.fetch, port }, (info) => {
  logger.info('ai-gateway listening', { port: info.port });
  logger.info('providers declared', { providers: providerRegistry.listDeclared() });
});
