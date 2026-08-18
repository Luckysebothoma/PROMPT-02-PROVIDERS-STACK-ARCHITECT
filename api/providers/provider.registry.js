import { GroqProvider } from './groq.provider.js';

/**
 * ProviderRegistry
 *
 * Builds provider adapter instances from environment configuration
 * and exposes lookup/health helpers. Only providers that are actually
 * implemented get an adapter instance; unimplemented-but-configured
 * providers (e.g. Gemini in Day 2) are reported as "not implemented"
 * rather than silently ignored.
 */
export class ProviderRegistry {
  constructor(env = process.env) {
    this.env = env;
    this.adapters = new Map();
    this.declared = new Map(); // providers known about, even if not adapted yet

    this._registerGroq();
    this._registerGemini();

    this.defaultProvider = env.AI_DEFAULT_PROVIDER || null;
    this.defaultModel = env.AI_DEFAULT_MODEL || null;
  }

  _registerGroq() {
    const enabled = String(this.env.GROQ_ENABLED || 'false').toLowerCase() === 'true';
    const apiKey = this.env.GROQ_API_KEY || null;
    const baseUrl = this.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';

    this.declared.set('groq', { implemented: true, enabled, configured: enabled && Boolean(apiKey) });

    if (enabled) {
      this.adapters.set('groq', new GroqProvider({ apiKey, baseUrl, enabled }));
    }
  }

  _registerGemini() {
    // Day 2 scope: configuration only. No adapter implemented yet.
    const enabled = String(this.env.GEMINI_ENABLED || 'false').toLowerCase() === 'true';
    const apiKey = this.env.GEMINI_API_KEY || null;

    this.declared.set('gemini', {
      implemented: false,
      enabled,
      configured: enabled && Boolean(apiKey),
    });
  }

  has(providerName) {
    return this.adapters.has(providerName);
  }

  get(providerName) {
    return this.adapters.get(providerName) || null;
  }

  listDeclared() {
    return Array.from(this.declared.entries()).map(([name, info]) => ({ name, ...info }));
  }

  /**
   * Lightweight health summary for GET /dependencies.
   * Never performs a live API call here.
   */
  async healthSummary() {
    const summary = {};
    for (const [name, info] of this.declared.entries()) {
      if (!info.implemented) {
        summary[name] = {
          enabled: info.enabled,
          configured: info.configured,
          status: 'not_implemented',
        };
        continue;
      }
      const adapter = this.adapters.get(name);
      if (!adapter) {
        summary[name] = { enabled: info.enabled, configured: false, status: 'disabled' };
        continue;
      }
      const health = await adapter.health();
      summary[name] = { enabled: info.enabled, ...health };
    }
    return summary;
  }
}
