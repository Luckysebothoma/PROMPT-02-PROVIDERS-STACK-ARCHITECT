import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelRegistry, ResolutionError } from '../api/providers/model.registry.js';
import { ProviderRegistry } from '../api/providers/provider.registry.js';

const FAKE_ROWS = [
  {
    id: 'model-1',
    model_key: 'llama-3.1-8b-instant',
    display_name: 'Llama 3.1 8B Instant',
    category: 'chat',
    model_enabled: true,
    temperature_default: 0.7,
    supports_json: true,
    supports_streaming: true,
    provider_name: 'groq',
    provider_enabled: true,
  },
  {
    id: 'model-2',
    model_key: 'disabled-model',
    display_name: 'Disabled Model',
    category: 'chat',
    model_enabled: false,
    temperature_default: 0.7,
    supports_json: false,
    supports_streaming: false,
    provider_name: 'groq',
    provider_enabled: true,
  },
];

function fakeDb(rows = FAKE_ROWS) {
  return { query: async () => ({ rows }) };
}

function configuredProviderRegistry() {
  return new ProviderRegistry({ GROQ_ENABLED: 'true', GROQ_API_KEY: 'test-key-not-real' });
}

test('resolve(): explicit provider + model resolves correctly', async () => {
  const registry = new ModelRegistry({ db: fakeDb(), providerRegistry: configuredProviderRegistry(), env: {} });
  const result = await registry.resolve({ provider: 'groq', model: 'llama-3.1-8b-instant' });
  assert.equal(result.provider, 'groq');
  assert.equal(result.model, 'llama-3.1-8b-instant');
});

test('resolve(): invalid model for provider throws MODEL_NOT_FOUND', async () => {
  const registry = new ModelRegistry({ db: fakeDb(), providerRegistry: configuredProviderRegistry(), env: {} });
  await assert.rejects(
    () => registry.resolve({ provider: 'groq', model: 'nonexistent-model' }),
    (err) => err instanceof ResolutionError && err.code === 'MODEL_NOT_FOUND'
  );
});

test('resolve(): invalid provider throws PROVIDER_NOT_FOUND', async () => {
  const registry = new ModelRegistry({ db: fakeDb(), providerRegistry: configuredProviderRegistry(), env: {} });
  await assert.rejects(
    () => registry.resolve({ provider: 'nonexistent-provider' }),
    (err) => err instanceof ResolutionError && err.code === 'PROVIDER_NOT_FOUND'
  );
});

test('resolve(): disabled model throws MODEL_DISABLED', async () => {
  const registry = new ModelRegistry({ db: fakeDb(), providerRegistry: configuredProviderRegistry(), env: {} });
  await assert.rejects(
    () => registry.resolve({ provider: 'groq', model: 'disabled-model' }),
    (err) => err instanceof ResolutionError && err.code === 'MODEL_DISABLED'
  );
});

test('resolve(): falls back to AI_DEFAULT_PROVIDER/AI_DEFAULT_MODEL', async () => {
  const registry = new ModelRegistry({
    db: fakeDb(),
    providerRegistry: configuredProviderRegistry(),
    env: { AI_DEFAULT_PROVIDER: 'groq', AI_DEFAULT_MODEL: 'llama-3.1-8b-instant' },
  });
  const result = await registry.resolve({});
  assert.equal(result.provider, 'groq');
  assert.equal(result.model, 'llama-3.1-8b-instant');
});

test('resolve(): no provider/model and no defaults -> NO_PROVIDER_CONFIGURED', async () => {
  const registry = new ModelRegistry({ db: fakeDb(), providerRegistry: configuredProviderRegistry(), env: {} });
  await assert.rejects(
    () => registry.resolve({}),
    (err) => err instanceof ResolutionError && err.code === 'NO_PROVIDER_CONFIGURED'
  );
});

test('resolve(): model resolved but provider not configured (no credentials) -> PROVIDER_NOT_CONFIGURED', async () => {
  const uncredentialedProviderRegistry = new ProviderRegistry({}); // GROQ_ENABLED unset
  const registry = new ModelRegistry({
    db: fakeDb(),
    providerRegistry: uncredentialedProviderRegistry,
    env: {},
  });
  await assert.rejects(
    () => registry.resolve({ provider: 'groq', model: 'llama-3.1-8b-instant' }),
    (err) => err instanceof ResolutionError && err.code === 'PROVIDER_NOT_CONFIGURED'
  );
});
