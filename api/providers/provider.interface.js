/**
 * ProviderAdapter interface (conceptual/documentation contract).
 *
 * Every concrete provider adapter (e.g. GroqProvider) must implement
 * this shape. JavaScript has no compile-time interfaces, so this file
 * documents the contract and provides a base class that throws if a
 * required method is not overridden.
 *
 * Methods:
 *   async chat({ model, messages, temperature, maxTokens }) -> {
 *     content: string,
 *     usage: { input_tokens: number|null, output_tokens: number|null, total_tokens: number|null },
 *     raw: object   // provider-native response, never leaked to the client
 *   }
 *
 *   async health() -> {
 *     configured: boolean,
 *     status: 'available' | 'unconfigured' | 'unknown'
 *   }
 *
 *   metadata() -> {
 *     name: string,
 *     baseUrl: string|null
 *   }
 */

export class ProviderAdapter {
  constructor(name) {
    if (!name) {
      throw new Error('ProviderAdapter requires a name');
    }
    this.name = name;
  }

  // eslint-disable-next-line no-unused-vars
  async chat(_request) {
    throw new Error(`Provider "${this.name}" does not implement chat()`);
  }

  async health() {
    throw new Error(`Provider "${this.name}" does not implement health()`);
  }

  metadata() {
    throw new Error(`Provider "${this.name}" does not implement metadata()`);
  }
}

/**
 * Structured error thrown by provider adapters.
 * Never expose raw provider error bodies/headers to the HTTP client.
 */
export class ProviderError extends Error {
  constructor(message, { provider, code = 'PROVIDER_ERROR', status = 502, cause } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider;
    this.code = code;
    this.status = status;
    if (cause) this.cause = cause;
  }
}
