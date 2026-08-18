import client from 'prom-client';

// Single shared registry for the process.
export const register = new client.Registry();
client.collectDefaultMetrics({ register });

// ---- Existing Stack 01 metrics are expected to already be registered
// elsewhere (e.g. HTTP request counters). This file only adds the
// Day 2 provider/model metrics. ----

export const providerRequestsTotal = new client.Counter({
  name: 'ai_gateway_provider_requests_total',
  help: 'Total number of provider chat requests attempted',
  labelNames: ['provider', 'model', 'operation', 'status'],
  registers: [register],
});

export const providerErrorsTotal = new client.Counter({
  name: 'ai_gateway_provider_errors_total',
  help: 'Total number of provider chat request errors',
  labelNames: ['provider', 'model', 'operation', 'status'],
  registers: [register],
});

export const providerRequestDuration = new client.Histogram({
  name: 'ai_gateway_provider_request_duration_seconds',
  help: 'Duration of provider chat requests in seconds',
  labelNames: ['provider', 'model', 'operation', 'status'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 20],
  registers: [register],
});

export const providerInputTokensTotal = new client.Counter({
  name: 'ai_gateway_provider_input_tokens_total',
  help: 'Total input tokens consumed, by provider and model',
  labelNames: ['provider', 'model'],
  registers: [register],
});

export const providerOutputTokensTotal = new client.Counter({
  name: 'ai_gateway_provider_output_tokens_total',
  help: 'Total output tokens generated, by provider and model',
  labelNames: ['provider', 'model'],
  registers: [register],
});

/**
 * Record a completed provider call. Never pass request_id, prompt,
 * instruction, message, or raw response text as label values.
 */
export function recordProviderCall({ provider, model, operation, status, durationSeconds, usage }) {
  const labels = { provider, model, operation, status };
  providerRequestsTotal.inc(labels);
  providerRequestDuration.observe(labels, durationSeconds);
  if (status === 'error') {
    providerErrorsTotal.inc(labels);
  }
  if (usage?.input_tokens != null) {
    providerInputTokensTotal.inc({ provider, model }, usage.input_tokens);
  }
  if (usage?.output_tokens != null) {
    providerOutputTokensTotal.inc({ provider, model }, usage.output_tokens);
  }
}
