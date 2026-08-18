import { Hono } from 'hono';
import crypto from 'node:crypto';
import { query } from '../db/client.js';
import { recordProviderCall } from '../lib/metrics.js';
import { logger } from '../lib/logger.js';
import { ResolutionError } from '../providers/model.registry.js';
import { ProviderError } from '../providers/provider.interface.js';

export const chatRoute = new Hono();

function badRequest(c, requestId, message) {
  return c.json(
    {
      success: false,
      request_id: requestId,
      error: { code: 'BAD_REQUEST', message },
    },
    400
  );
}

chatRoute.post('/v1/chat', async (c) => {
  const requestId = crypto.randomUUID();
  const modelRegistry = c.get('modelRegistry');
  const providerRegistry = c.get('providerRegistry');

  let body;
  try {
    body = await c.req.json();
  } catch {
    return badRequest(c, requestId, 'Request body must be valid JSON');
  }

  const { provider, model, message, instruction, temperature } = body || {};

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return badRequest(c, requestId, '"message" is required and must be a non-empty string');
  }

  // ---- Resolution ----
  let resolved;
  try {
    resolved = await modelRegistry.resolve({ provider, model });
  } catch (err) {
    if (err instanceof ResolutionError) {
      await persistFailedRequest(requestId, provider, model, err.code);
      return c.json(
        {
          success: false,
          request_id: requestId,
          error: { code: err.code, message: err.message },
        },
        err.code === 'NO_PROVIDER_CONFIGURED' ? 503 : 404
      );
    }
    throw err;
  }

  const adapter = providerRegistry.get(resolved.provider);
  if (!adapter) {
    await persistFailedRequest(requestId, resolved.provider, resolved.model, 'PROVIDER_NOT_CONFIGURED');
    return c.json(
      {
        success: false,
        request_id: requestId,
        error: {
          code: 'PROVIDER_NOT_CONFIGURED',
          message: `Provider "${resolved.provider}" is not configured with credentials`,
        },
      },
      503
    );
  }

  const messages = [];
  if (instruction && typeof instruction === 'string') {
    messages.push({ role: 'system', content: instruction });
  }
  messages.push({ role: 'user', content: message });

  const effectiveTemperature =
    typeof temperature === 'number' ? temperature : resolved.meta.temperature_default ?? undefined;

  const startedAt = process.hrtime.bigint();
  let result;
  let status = 'success';
  try {
    result = await adapter.chat({
      model: resolved.model,
      messages,
      temperature: effectiveTemperature,
    });
  } catch (err) {
    status = 'error';
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    recordProviderCall({
      provider: resolved.provider,
      model: resolved.model,
      operation: 'chat',
      status,
      durationSeconds,
      usage: null,
    });

    const code = err instanceof ProviderError ? err.code : 'PROVIDER_UNKNOWN_ERROR';
    logger.error('provider chat call failed', {
      request_id: requestId,
      provider: resolved.provider,
      model: resolved.model,
      code,
    });

    await persistFailedRequest(requestId, resolved.provider, resolved.model, code, resolved.meta.model_id);

    // Do not expose internal provider API errors directly.
    return c.json(
      {
        success: false,
        request_id: requestId,
        error: { code, message: 'The AI provider request failed' },
      },
      err instanceof ProviderError ? err.status : 502
    );
  }

  const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
  recordProviderCall({
    provider: resolved.provider,
    model: resolved.model,
    operation: 'chat',
    status,
    durationSeconds,
    usage: result.usage,
  });

  await persistSuccessRequest({
    requestId,
    provider: resolved.provider,
    model: resolved.model,
    modelId: resolved.meta.model_id,
    usage: result.usage,
  });

  return c.json({
    success: true,
    request_id: requestId,
    data: { content: result.content },
    meta: {
      provider: resolved.provider,
      model: resolved.model,
      cached: false,
      usage: result.usage,
    },
  });
});

async function persistSuccessRequest({ requestId, provider, model, modelId, usage }) {
  try {
    await query(
      `INSERT INTO chat_requests
        (request_id, provider, model, model_id, status, input_tokens, output_tokens, total_tokens)
       VALUES ($1, $2, $3, $4, 'success', $5, $6, $7)`,
      [requestId, provider, model, modelId || null, usage?.input_tokens ?? null, usage?.output_tokens ?? null, usage?.total_tokens ?? null]
    );
  } catch (err) {
    logger.error('failed to persist chat_requests row', { request_id: requestId, error: err.message });
  }
}

async function persistFailedRequest(requestId, provider, model, errorCode, modelId) {
  try {
    await query(
      `INSERT INTO chat_requests
        (request_id, provider, model, model_id, status, error_code)
       VALUES ($1, $2, $3, $4, 'error', $5)`,
      [requestId, provider || null, model || null, modelId || null, errorCode]
    );
  } catch (err) {
    logger.error('failed to persist failed chat_requests row', { request_id: requestId, error: err.message });
  }
}
