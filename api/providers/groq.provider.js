import { ProviderAdapter, ProviderError } from './provider.interface.js';

/**
 * Groq provider adapter.
 *
 * Uses Groq's OpenAI-compatible /chat/completions endpoint.
 * https://console.groq.com/docs/api-reference#chat-create
 *
 * This adapter performs a real network call. It is only invoked when:
 *   - GROQ_ENABLED=true
 *   - GROQ_API_KEY is set
 *   - resolution selected provider "groq"
 */
export class GroqProvider extends ProviderAdapter {
  constructor({ apiKey, baseUrl, enabled }) {
    super('groq');
    this.apiKey = apiKey || null;
    this.baseUrl = baseUrl || 'https://api.groq.com/openai/v1';
    this.enabled = enabled === true;
  }

  metadata() {
    return {
      name: this.name,
      baseUrl: this.baseUrl,
    };
  }

  isConfigured() {
    return this.enabled && Boolean(this.apiKey);
  }

  async health() {
    if (!this.enabled) {
      return { configured: false, status: 'disabled' };
    }
    if (!this.apiKey) {
      return { configured: false, status: 'unconfigured' };
    }
    // Lightweight check only: do not call the live chat API on every
    // /dependencies request. Presence of enabled+key is treated as
    // "available" for the purposes of this health summary.
    return { configured: true, status: 'available' };
  }

  async chat({ model, messages, temperature, maxTokens }) {
    if (!this.isConfigured()) {
      throw new ProviderError('Groq provider is not configured', {
        provider: this.name,
        code: 'PROVIDER_NOT_CONFIGURED',
        status: 503,
      });
    }

    if (!model) {
      throw new ProviderError('Groq provider requires a resolved model id', {
        provider: this.name,
        code: 'MODEL_REQUIRED',
        status: 400,
      });
    }

    let response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: temperature ?? undefined,
          max_tokens: maxTokens ?? undefined,
        }),
      });
    } catch (err) {
      throw new ProviderError('Failed to reach Groq API', {
        provider: this.name,
        code: 'PROVIDER_UNREACHABLE',
        status: 502,
        cause: err,
      });
    }

    let body;
    try {
      body = await response.json();
    } catch (err) {
      throw new ProviderError('Groq API returned a non-JSON response', {
        provider: this.name,
        code: 'PROVIDER_INVALID_RESPONSE',
        status: 502,
        cause: err,
      });
    }

    if (!response.ok) {
      // Do not leak raw provider error body/headers to the HTTP client.
      throw new ProviderError('Groq API request failed', {
        provider: this.name,
        code: `PROVIDER_HTTP_${response.status}`,
        status: 502,
        cause: body,
      });
    }

    const content = body?.choices?.[0]?.message?.content ?? null;
    const usage = body?.usage
      ? {
          input_tokens: body.usage.prompt_tokens ?? null,
          output_tokens: body.usage.completion_tokens ?? null,
          total_tokens: body.usage.total_tokens ?? null,
        }
      : { input_tokens: null, output_tokens: null, total_tokens: null };

    return { content, usage, raw: body };
  }
}
