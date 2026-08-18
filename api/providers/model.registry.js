/**
 * ModelRegistry
 *
 * Loads provider + model rows from PostgreSQL and provides
 * deterministic resolution of (provider, model) pairs for a
 * /v1/chat request.
 *
 * Resolution order (see ARCHITECTURE.md):
 *   1. explicitly requested provider + model
 *   2. explicitly requested model only (looked up regardless of provider,
 *      only if exactly one enabled model matches that model_key)
 *   3. AI_DEFAULT_PROVIDER + AI_DEFAULT_MODEL
 *   4. controlled failure (structured error, no fabrication)
 *
 * Agent/model mapping (step 3 in the prompt's recommended order) is
 * NOT implemented in Day 2 - agent registry is PROMPT-03 scope.
 */
export class ModelRegistry {
  constructor({ db, providerRegistry, env = process.env }) {
    this.db = db;
    this.providerRegistry = providerRegistry;
    this.defaultProvider = env.AI_DEFAULT_PROVIDER || null;
    this.defaultModel = env.AI_DEFAULT_MODEL || null;
    this._cache = null;
    this._cacheLoadedAt = 0;
    this._cacheTtlMs = 30_000;
  }

  async _loadModels() {
    const now = Date.now();
    if (this._cache && now - this._cacheLoadedAt < this._cacheTtlMs) {
      return this._cache;
    }

    const { rows } = await this.db.query(`
      SELECT
        m.id,
        m.model_key,
        m.display_name,
        m.category,
        m.enabled AS model_enabled,
        m.temperature_default,
        m.supports_json,
        m.supports_streaming,
        p.name AS provider_name,
        p.enabled AS provider_enabled
      FROM models m
      JOIN providers p ON p.id = m.provider_id
    `);

    this._cache = rows;
    this._cacheLoadedAt = now;
    return rows;
  }

  invalidateCache() {
    this._cache = null;
  }

  async listModels({ providerName, category, enabledOnly = true } = {}) {
    const rows = await this._loadModels();
    return rows.filter((r) => {
      if (enabledOnly && (!r.model_enabled || !r.provider_enabled)) return false;
      if (providerName && r.provider_name !== providerName) return false;
      if (category && r.category !== category) return false;
      return true;
    });
  }

  /**
   * Resolve a chat request to a concrete { provider, model, meta } pair.
   * Throws a ResolutionError (never invents a provider/model) on failure.
   */
  async resolve({ provider: requestedProvider, model: requestedModel } = {}) {
    const rows = await this._loadModels();

    // Step 1: explicit provider + explicit model
    if (requestedProvider && requestedModel) {
      const match = rows.find(
        (r) => r.provider_name === requestedProvider && r.model_key === requestedModel
      );
      if (!match) {
        throw new ResolutionError(
          `Model "${requestedModel}" is not registered for provider "${requestedProvider}"`,
          'MODEL_NOT_FOUND'
        );
      }
      return this._finalizeMatch(match, requestedProvider);
    }

    // Step 1b: explicit provider only -> use provider's registered default-ish first enabled model
    if (requestedProvider && !requestedModel) {
      const candidates = rows.filter((r) => r.provider_name === requestedProvider);
      if (candidates.length === 0) {
        throw new ResolutionError(
          `Provider "${requestedProvider}" has no registered models`,
          'PROVIDER_NOT_FOUND'
        );
      }
      const enabled = candidates.filter((r) => r.model_enabled && r.provider_enabled);
      if (enabled.length === 0) {
        throw new ResolutionError(
          `Provider "${requestedProvider}" has no enabled models`,
          'PROVIDER_UNAVAILABLE'
        );
      }
      return this._finalizeMatch(enabled[0], requestedProvider);
    }

    // Step 2: explicit model only (no provider specified) - resolve unambiguously
    if (!requestedProvider && requestedModel) {
      const matches = rows.filter((r) => r.model_key === requestedModel);
      if (matches.length === 0) {
        throw new ResolutionError(`Model "${requestedModel}" is not registered`, 'MODEL_NOT_FOUND');
      }
      if (matches.length > 1) {
        throw new ResolutionError(
          `Model "${requestedModel}" is ambiguous across multiple providers; specify "provider"`,
          'MODEL_AMBIGUOUS'
        );
      }
      return this._finalizeMatch(matches[0], matches[0].provider_name);
    }

    // Step 3: fall back to configured defaults
    if (this.defaultProvider && this.defaultModel) {
      const match = rows.find(
        (r) => r.provider_name === this.defaultProvider && r.model_key === this.defaultModel
      );
      if (match) {
        return this._finalizeMatch(match, this.defaultProvider);
      }
      throw new ResolutionError(
        `Configured default "${this.defaultProvider}/${this.defaultModel}" is not registered or not enabled`,
        'DEFAULT_UNAVAILABLE'
      );
    }

    // Step 4: controlled failure - do not invent a provider or model
    throw new ResolutionError(
      'No provider/model specified and no AI_DEFAULT_PROVIDER / AI_DEFAULT_MODEL configured',
      'NO_PROVIDER_CONFIGURED'
    );
  }

  _finalizeMatch(row, providerName) {
    if (!row.model_enabled || !row.provider_enabled) {
      throw new ResolutionError(
        `Model "${row.model_key}" on provider "${providerName}" is disabled`,
        'MODEL_DISABLED'
      );
    }
    if (!this.providerRegistry.has(providerName)) {
      throw new ResolutionError(
        `Provider "${providerName}" is not configured with credentials`,
        'PROVIDER_NOT_CONFIGURED'
      );
    }
    return {
      provider: providerName,
      model: row.model_key,
      meta: {
        model_id: row.id,
        display_name: row.display_name,
        category: row.category,
        temperature_default: row.temperature_default,
        supports_json: row.supports_json,
        supports_streaming: row.supports_streaming,
      },
    };
  }
}

export class ResolutionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ResolutionError';
    this.code = code;
  }
}
