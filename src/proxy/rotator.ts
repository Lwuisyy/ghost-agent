import type { ProxyConfig } from '../core/types.js';
import type { Logger } from '../utils/logger.js';

/**
 * ProxyRotator wraps ProxyPool to provide automatic retry + rotation
 * on proxy failure. Handles the "try next proxy on block/fail" logic.
 */
export class ProxyRotator {
  private failedInSession: Set<string> = new Set();

  constructor(
    private maxRetries: number,
    private logger: Logger
  ) {}

  /**
   * Execute a function with automatic proxy rotation on failure.
   * Tries up to maxRetries different proxies before giving up.
   */
  async withRotation<T>(
    getProxy: (exclude: Set<string>) => ProxyConfig | null,
    fn: (proxy: ProxyConfig) => Promise<T>,
    onFailure?: (proxy: ProxyConfig, error: Error) => void
  ): Promise<{ result: T; proxy: ProxyConfig }> {
    this.failedInSession.clear();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const proxy = getProxy(this.failedInSession);

      if (!proxy) {
        throw new Error(`No available proxies after ${attempt} attempts`);
      }

      try {
        const result = await fn(proxy);
        this.logger.debug(
          { proxy: `${proxy.host}:${proxy.port}`, attempt },
          'Proxy rotation: success'
        );
        return { result, proxy };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const key = `${proxy.host}:${proxy.port}`;
        this.failedInSession.add(key);

        this.logger.warn(
          { proxy: key, attempt, error: lastError.message },
          'Proxy rotation: failed, trying next'
        );

        onFailure?.(proxy, lastError);
      }
    }

    throw new Error(
      `All ${this.maxRetries} proxy attempts failed. Last error: ${lastError?.message}`
    );
  }
}
