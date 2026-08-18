import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { chatRoute } from '../api/routes/chat.js';
import { ResolutionError } from '../api/providers/model.registry.js';

// NOTE: these are route-logic tests using fake registries injected via
// context, not full end-to-end tests against a live Postgres/Redis.
// DB persistence calls will fail silently (caught + logged) since no
// real database is available in this test environment - this is
// expected and does not fail the test.

function buildApp({ modelRegistry, providerRegistry }) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('modelRegistry', modelRegistry);
    c.set('providerRegistry', providerRegistry);
    await next();
  });
  app.route('/', chatRoute);
  return app;
}

test('POST /v1/chat: missing message -> 400 BAD_REQUEST', async () => {
  const app = buildApp({
    modelRegistry: { resolve: async () => ({}) },
    providerRegistry: { get: () => null },
  });
  const res = await app.request('/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'BAD_REQUEST');
});

test('POST /v1/chat: no provider configured -> 503 NO_PROVIDER_CONFIGURED', async () => {
  const app = buildApp({
    modelRegistry: {
      resolve: async () => {
        throw new ResolutionError('No provider configured', 'NO_PROVIDER_CONFIGURED');
      },
    },
    providerRegistry: { get: () => null },
  });
  const res = await app.request('/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error.code, 'NO_PROVIDER_CONFIGURED');
});

test('POST /v1/chat: resolved model but adapter missing -> 503 PROVIDER_NOT_CONFIGURED', async () => {
  const app = buildApp({
    modelRegistry: {
      resolve: async () => ({
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        meta: { model_id: 'x', temperature_default: 0.7 },
      }),
    },
    providerRegistry: { get: () => null },
  });
  const res = await app.request('/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error.code, 'PROVIDER_NOT_CONFIGURED');
});

test('POST /v1/chat: successful chat returns envelope with content + meta', async () => {
  const app = buildApp({
    modelRegistry: {
      resolve: async () => ({
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        meta: { model_id: 'x', temperature_default: 0.7 },
      }),
    },
    providerRegistry: {
      get: () => ({
        chat: async () => ({
          content: 'Hello there!',
          usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
          raw: {},
        }),
      }),
    },
  });
  const res = await app.request('/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.content, 'Hello there!');
  assert.equal(body.meta.provider, 'groq');
  assert.equal(body.meta.model, 'llama-3.1-8b-instant');
  assert.equal(body.meta.cached, false);
});

test('POST /v1/chat: provider error is not leaked to client', async () => {
  const app = buildApp({
    modelRegistry: {
      resolve: async () => ({
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        meta: { model_id: 'x', temperature_default: 0.7 },
      }),
    },
    providerRegistry: {
      get: () => ({
        chat: async () => {
          const { ProviderError } = await import('../api/providers/provider.interface.js');
          throw new ProviderError('Groq API request failed', {
            provider: 'groq',
            code: 'PROVIDER_HTTP_401',
            status: 502,
            cause: { secret_header: 'Bearer sk-should-not-leak' },
          });
        },
      }),
    },
  });
  const res = await app.request('/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  });
  assert.equal(res.status, 502);
  const body = await res.json();
  const raw = JSON.stringify(body);
  assert.ok(!raw.includes('sk-should-not-leak'));
  assert.equal(body.error.code, 'PROVIDER_HTTP_401');
});
