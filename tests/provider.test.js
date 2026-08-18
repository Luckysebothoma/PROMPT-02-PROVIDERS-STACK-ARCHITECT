import assert from 'node:assert/strict';
import test from 'node:test';
import { ProviderRegistry } from '../api/providers/provider.registry.js';
import { GroqProvider } from '../api/providers/groq.provider.js';

test('ProviderRegistry: groq disabled by default when GROQ_ENABLED unset', () => {
  const registry = new ProviderRegistry({});
  assert.equal(registry.has('groq'), false);
  const declared = registry.listDeclared().find((p) => p.name === 'groq');
  assert.equal(declared.enabled, false);
});

test('ProviderRegistry: groq registered when enabled + key present', () => {
  const registry = new ProviderRegistry({
    GROQ_ENABLED: 'true',
    GROQ_API_KEY: 'test-key-not-real',
    GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
  });
  assert.equal(registry.has('groq'), true);
  assert.ok(registry.get('groq') instanceof GroqProvider);
});

test('ProviderRegistry: gemini is declared but not_implemented', async () => {
  const registry = new ProviderRegistry({ GEMINI_ENABLED: 'true', GEMINI_API_KEY: 'x' });
  const summary = await registry.healthSummary();
  assert.equal(summary.gemini.status, 'not_implemented');
});

test('ProviderRegistry: missing provider configuration -> /dependencies reports disabled', async () => {
  const registry = new ProviderRegistry({});
  const summary = await registry.healthSummary();
  assert.equal(summary.groq.status, 'disabled');
  assert.equal(summary.groq.configured, false);
});

test('GroqProvider: chat() throws PROVIDER_NOT_CONFIGURED when no api key', async () => {
  const provider = new GroqProvider({ apiKey: null, enabled: true });
  await assert.rejects(
    () => provider.chat({ model: 'llama-3.1-8b-instant', messages: [] }),
    (err) => err.code === 'PROVIDER_NOT_CONFIGURED'
  );
});

test('GroqProvider: health() reflects unconfigured vs disabled vs available', async () => {
  const disabled = new GroqProvider({ enabled: false });
  assert.equal((await disabled.health()).status, 'disabled');

  const unconfigured = new GroqProvider({ enabled: true, apiKey: null });
  assert.equal((await unconfigured.health()).status, 'unconfigured');

  const available = new GroqProvider({ enabled: true, apiKey: 'test-key-not-real' });
  assert.equal((await available.health()).status, 'available');
});
