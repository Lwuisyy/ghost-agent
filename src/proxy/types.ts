import type { ProxyConfig, ProxyStats } from '../core/types.js';

/**
 * Parse a proxy URL string into a ProxyConfig object.
 * Supports: http://user:pass@host:port, socks5://host:port, etc.
 */
export function parseProxyUrl(url: string): ProxyConfig {
  const parsed = new URL(url);
  const protocol = parsed.protocol.replace(':', '') as ProxyConfig['protocol'];

  return {
    url,
    protocol,
    host: parsed.hostname,
    port: Number(parsed.port) || (protocol === 'https' ? 443 : 8080),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
  };
}

/**
 * Reconstruct a proxy URL string from config, optionally injecting auth.
 */
export function buildProxyUrl(config: ProxyConfig): string {
  const auth = config.username && config.password
    ? `${config.username}:${config.password}@`
    : '';
  return `${config.protocol}://${auth}${config.host}:${config.port}`;
}

/**
 * Create empty stats for a new proxy.
 */
export function createProxyStats(): ProxyStats {
  return {
    totalRequests: 0,
    successCount: 0,
    failCount: 0,
    avgLatencyMs: 0,
    lastUsed: 0,
    isHealthy: true,
    bannedDomains: new Set(),
  };
}
