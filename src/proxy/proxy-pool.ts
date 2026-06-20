import type { ProxyConfig, ProxyStrategy } from '../core/types.js';
import type { Logger } from '../utils/logger.js';
import { createProxyStats } from './types.js';
import type { ProxyStats } from '../core/types.js';

interface ProxyEntry {
  config: ProxyConfig;
  stats: ProxyStats;
}

/**
 * ProxyPool manages a collection of proxies with health tracking
 * and multiple rotation strategies.
 */
export class ProxyPool {
  private proxies: Map<string, ProxyEntry> = new Map();
  private healthy: string[] = [];
  private roundRobinIndex = 0;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private strategy: ProxyStrategy,
    readonly maxRetries: number,
    private healthCheckInterval: number,
    private logger: Logger
  ) {}

  /** Add proxies to the pool. */
  addProxies(configs: ProxyConfig[]): void {
    for (const config of configs) {
      const key = `${config.host}:${config.port}`;
      if (!this.proxies.has(key)) {
        this.proxies.set(key, { config, stats: createProxyStats() });
        this.healthy.push(key);
        this.logger.debug({ proxy: key }, 'Proxy added to pool');
      }
    }
  }

  /** Get the next proxy based on the rotation strategy. */
  getNext(excludeHosts?: Set<string>, geo?: string): ProxyConfig | null {
    const candidates = this.healthy.filter(key => {
      const entry = this.proxies.get(key);
      if (!entry) return false;
      if (excludeHosts?.has(entry.config.host)) return false;
      if (geo && entry.config.geo && entry.config.geo !== geo) return false;
      return true;
    });

    if (candidates.length === 0) {
      this.logger.warn('No healthy proxies available');
      return null;
    }

    let selectedKey: string;

    switch (this.strategy) {
      case 'round-robin':
        this.roundRobinIndex = this.roundRobinIndex % candidates.length;
        selectedKey = candidates[this.roundRobinIndex]!;
        this.roundRobinIndex++;
        break;

      case 'random':
        selectedKey = candidates[Math.floor(Math.random() * candidates.length)]!;
        break;

      case 'least-used': {
        selectedKey = candidates.reduce((best, key) => {
          const bestStats = this.proxies.get(best)?.stats;
          const keyStats = this.proxies.get(key)?.stats;
          return (keyStats?.totalRequests ?? 0) < (bestStats?.totalRequests ?? 0) ? key : best;
        }, candidates[0]!);
        break;
      }

      case 'geo-target': {
        const geoMatched = candidates.filter(key => {
          const entry = this.proxies.get(key);
          return entry?.config.geo === geo;
        });
        selectedKey = geoMatched.length > 0
          ? geoMatched[Math.floor(Math.random() * geoMatched.length)]!
          : candidates[Math.floor(Math.random() * candidates.length)]!;
        break;
      }

      default:
        selectedKey = candidates[0]!;
    }

    return this.proxies.get(selectedKey)?.config ?? null;
  }

  /** Report success for a proxy. */
  reportSuccess(proxy: ProxyConfig, latencyMs: number): void {
    const key = `${proxy.host}:${proxy.port}`;
    const entry = this.proxies.get(key);
    if (!entry) return;

    entry.stats.totalRequests++;
    entry.stats.successCount++;
    entry.stats.lastUsed = Date.now();
    entry.stats.avgLatencyMs =
      (entry.stats.avgLatencyMs * (entry.stats.successCount - 1) + latencyMs) /
      entry.stats.successCount;
  }

  /** Report failure for a proxy. Marks unhealthy after threshold. */
  reportFailure(proxy: ProxyConfig, domain?: string): void {
    const key = `${proxy.host}:${proxy.port}`;
    const entry = this.proxies.get(key);
    if (!entry) return;

    entry.stats.totalRequests++;
    entry.stats.failCount++;
    entry.stats.lastUsed = Date.now();

    if (domain) {
      entry.stats.bannedDomains.add(domain);
    }

    const failRate = entry.stats.failCount / entry.stats.totalRequests;
    if (failRate > 0.5 && entry.stats.totalRequests > 5) {
      entry.stats.isHealthy = false;
      this.healthy = this.healthy.filter(k => k !== key);
      this.logger.warn({ proxy: key, failRate }, 'Proxy marked unhealthy');
    }
  }

  /** Run a health check on all proxies. */
  async healthCheck(checker: (proxy: ProxyConfig) => Promise<boolean>): Promise<void> {
    const entries = [...this.proxies.values()];
    const results = await Promise.allSettled(
      entries.map(async (entry) => {
        const ok = await checker(entry.config);
        return { key: `${entry.config.host}:${entry.config.port}`, ok };
      })
    );

    this.healthy = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const entry = this.proxies.get(result.value.key);
        if (entry) {
          entry.stats.isHealthy = result.value.ok;
          if (result.value.ok) {
            this.healthy.push(result.value.key);
          }
        }
      }
    }

    this.logger.debug({ healthy: this.healthy.length, total: this.proxies.size }, 'Health check complete');
  }

  /** Start periodic health checks. */
  startHealthChecks(checker: (proxy: ProxyConfig) => Promise<boolean>): void {
    this.stopHealthChecks();
    this.healthCheckTimer = setInterval(() => {
      this.healthCheck(checker).catch(err =>
        this.logger.error({ err }, 'Health check failed')
      );
    }, this.healthCheckInterval);
  }

  /** Stop periodic health checks. */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /** Get pool statistics. */
  getStats(): { total: number; healthy: number; maxRetries: number; proxies: Map<string, ProxyStats> } {
    const stats = new Map<string, ProxyStats>();
    for (const [key, entry] of this.proxies) {
      stats.set(key, { ...entry.stats });
    }
    return { total: this.proxies.size, healthy: this.healthy.length, maxRetries: this.maxRetries, proxies: stats };
  }

  /** Destroy the pool and clean up. */
  destroy(): void {
    this.stopHealthChecks();
    this.proxies.clear();
    this.healthy = [];
  }
}
