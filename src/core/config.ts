import { config } from 'dotenv';
import { ConfigSchema, type GhostAgentConfig } from './types.js';

config(); // load .env

function parseProxyList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Build a validated config from environment variables + overrides.
 */
export function loadConfig(overrides: Partial<GhostAgentConfig> = {}): GhostAgentConfig {
  const envConfig = {
    proxy: {
      list: parseProxyList(process.env.PROXY_LIST),
      apiUrl: process.env.PROXY_API_URL || undefined,
      strategy: (process.env.PROXY_STRATEGY as GhostAgentConfig['proxy']['strategy']) || 'round-robin',
      maxRetries: Number(process.env.PROXY_MAX_RETRIES) || 3,
      healthCheckInterval: Number(process.env.PROXY_HEALTH_CHECK_INTERVAL) || 30000,
    },
    captcha: {
      provider: (process.env.CAPTCHA_PROVIDER as GhostAgentConfig['captcha']['provider']) || '2captcha',
      apiKey: process.env.CAPTCHA_API_KEY || undefined,
    },
    session: {
      maxSessions: Number(process.env.MAX_SESSIONS) || 10,
      ttl: Number(process.env.SESSION_TTL) || 300000,
      persistCookies: process.env.COOKIE_PERSIST === 'true',
    },
    rateLimit: {
      minDelay: Number(process.env.RATE_LIMIT_MIN_DELAY) || 1000,
      maxDelay: Number(process.env.RATE_LIMIT_MAX_DELAY) || 5000,
      humanJitter: process.env.HUMAN_JITTER !== 'false',
      maxConcurrent: 5,
      burstLimit: 10,
      burstWindow: 60000,
    },
    log: {
      level: (process.env.LOG_LEVEL as GhostAgentConfig['log']['level']) || 'info',
    },
  };

  // Deep merge overrides on top of env config
  const merged = deepMerge(envConfig, overrides);
  return ConfigSchema.parse(merged);
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}
