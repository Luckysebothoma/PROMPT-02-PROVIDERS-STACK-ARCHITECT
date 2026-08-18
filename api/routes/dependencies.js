import { Hono } from 'hono';
import net from 'node:net';
import dns from 'node:dns/promises';
import { pingDb } from '../db/client.js';
import { createClient } from 'redis';

export const dependenciesRoute = new Hono();

async function checkTcp(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish('PASS'));
    socket.once('timeout', () => finish('FAIL'));
    socket.once('error', () => finish('FAIL'));
    socket.connect(port, host);
  });
}

async function checkDns(host) {
  try {
    await dns.lookup(host);
    return 'PASS';
  } catch {
    return 'FAIL';
  }
}

dependenciesRoute.get('/dependencies', async (c) => {
  const env = process.env;
  const pgHost = env.POSTGRES_HOST;
  const pgPort = Number(env.POSTGRES_PORT || 5432);
  const redisHost = env.REDIS_HOST;
  const redisPort = Number(env.REDIS_PORT || 6379);

  // This route executes INSIDE the API container. Results here reflect
  // CONTAINER network reachability only. Host-side reachability must be
  // verified separately (see scripts/dependency-check.sh run from host),
  // per the Day 1 lesson: container and host DNS/TCP results can differ.
  const [pgDns, pgTcp, redisDns, redisTcp, pgApp] = await Promise.all([
    checkDns(pgHost),
    checkTcp(pgHost, pgPort),
    checkDns(redisHost),
    checkTcp(redisHost, redisPort),
    pingDb(),
  ]);

  let redisApp = 'FAIL';
  try {
    const client = createClient({
      socket: { host: redisHost, port: redisPort, connectTimeout: 2000 },
      password: env.REDIS_PASSWORD || undefined,
    });
    client.on('error', () => {});
    await client.connect();
    await client.ping();
    await client.quit();
    redisApp = 'PASS';
  } catch {
    redisApp = 'FAIL';
  }

  const providerRegistry = c.get('providerRegistry');
  const providers = providerRegistry ? await providerRegistry.healthSummary() : {};

  return c.json({
    success: true,
    test_location: 'container',
    dependencies: {
      postgres: {
        target: `${pgHost}:${pgPort}`,
        dns: pgDns,
        tcp: pgTcp,
        application: pgApp ? 'PASS' : 'FAIL',
      },
      redis: {
        target: `${redisHost}:${redisPort}`,
        dns: redisDns,
        tcp: redisTcp,
        application: redisApp,
      },
    },
    providers,
    note: 'Results reflect container network reachability. Run scripts/dependency-check.sh from the host for host-side results; they are not guaranteed to match.',
    timestamp: new Date().toISOString(),
  });
});
