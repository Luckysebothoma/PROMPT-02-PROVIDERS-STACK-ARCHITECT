import { Hono } from 'hono';
import { pingDb } from '../db/client.js';

export const readyRoute = new Hono();

readyRoute.get('/ready', async (c) => {
  const dbOk = await pingDb();
  const ready = dbOk;
  return c.json(
    {
      success: ready,
      ready,
      checks: {
        database: dbOk ? 'ok' : 'fail',
      },
      timestamp: new Date().toISOString(),
    },
    ready ? 200 : 503
  );
});
