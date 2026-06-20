import { EventEmitter } from 'eventemitter3';
import type {
  GhostAgentConfig,
  GhostRequest,
  GhostResponse,
  SessionConfig,
  SessionState,
  ProxyConfig,
  CaptchaTask,
} from './core/types.js';
import { loadConfig } from './core/config.js';
import { createLogger, type Logger } from './utils/logger.js';
import { ProxyPool, ProxyRotator, parseProxyUrl } from './proxy/index.js';
import { SessionManager } from './session/index.js';
import { FingerprintGenerator, buildStealthHeaders, isBlockedResponse, detectCaptcha } from './browser/index.js';
import { CaptchaManager } from './captcha/index.js';

export interface GhostAgentEvents {
  'request': (req: GhostRequest) => void;
  'response': (res: GhostResponse) => void;
  'block-detected': (url: string, session: string) => void;
  'captcha-detected': (task: CaptchaTask, session: string) => void;
  'proxy-fail': (proxy: ProxyConfig, error: Error) => void;
  'session-created': (session: SessionState) => void;
  'session-destroyed': (sessionId: string) => void;
  'error': (error: Error) => void;
}

/**
 * GhostAgent — the main orchestrator that ties together:
 * - Proxy rotation & pool management
 * - Session isolation (fingerprint + cookies per session)
 * - Browser fingerprint generation
 * - CAPTCHA solving
 * - Rate limiting & human-like delays
 * - Block/captcha detection
 *
 * Usage:
 * ```ts
 * const ghost = new GhostAgent({ ... });
 * await ghost.init();
 *
 * const session = ghost.createSession();
 * const res = await ghost.fetch({ url: 'https://example.com', sessionId: session.id });
 * console.log(res.body);
 *
 * ghost.destroy();
 * ```
 */
export class GhostAgent extends EventEmitter<GhostAgentEvents> {
  private config: GhostAgentConfig;
  private logger: Logger;
  private proxyPool: ProxyPool;
  private proxyRotator: ProxyRotator;
  private sessionManager: SessionManager;
  private fingerprintGen: FingerprintGenerator;
  private captchaManager: CaptchaManager;
  private activeRequests = 0;
  private lastRequestTime = 0;

  constructor(configOverrides: Partial<GhostAgentConfig> = {}) {
    super();
    this.config = loadConfig(configOverrides);
    this.logger = createLogger(this.config.log.level);
    this.fingerprintGen = new FingerprintGenerator();

    // Initialize proxy pool
    this.proxyPool = new ProxyPool(
      this.config.proxy.strategy,
      this.config.proxy.maxRetries,
      this.config.proxy.healthCheckInterval,
      this.logger
    );

    this.proxyRotator = new ProxyRotator(this.config.proxy.maxRetries, this.logger);

    // Initialize session manager
    this.sessionManager = new SessionManager(
      this.config.session.maxSessions,
      this.config.session.ttl,
      this.fingerprintGen,
      this.logger
    );

    // Initialize captcha manager
    this.captchaManager = new CaptchaManager(
      this.config.captcha.provider,
      this.config.captcha.apiKey,
      this.logger
    );
  }

  /**
   * Initialize the agent: load proxies, start health checks.
   */
  async init(): Promise<void> {
    this.logger.info('GhostAgent initializing...');

    // Load proxies from config
    if (this.config.proxy.list.length > 0) {
      const proxies = this.config.proxy.list.map(parseProxyUrl);
      this.proxyPool.addProxies(proxies);
      this.logger.info({ count: proxies.length }, 'Proxies loaded');
    }

    // Fetch proxies from API if configured
    if (this.config.proxy.apiUrl) {
      try {
        await this.fetchProxiesFromApi(this.config.proxy.apiUrl);
      } catch (err) {
        this.logger.warn({ err }, 'Failed to fetch proxies from API');
      }
    }

    // Start health checks if we have proxies
    if (this.proxyPool.getStats().total > 0) {
      this.proxyPool.startHealthChecks(async (_proxy) => {
        try {
          const res = await fetch('https://httpbin.org/ip', {
            signal: AbortSignal.timeout(5000),
          });
          return res.ok;
        } catch {
          return false;
        }
      });
    }

    this.logger.info('GhostAgent ready');
  }

  /**
   * Create an isolated browsing session.
   */
  createSession(config?: SessionConfig): SessionState {
    const session = this.sessionManager.create(config);
    this.emit('session-created', session);
    return session;
  }

  /**
   * Destroy a session.
   */
  destroySession(sessionId: string): void {
    this.sessionManager.destroy(sessionId);
    this.emit('session-destroyed', sessionId);
  }

  /**
   * Make a stealth HTTP request with full anti-detection pipeline:
   * 1. Rate limit / human-like delay
   * 2. Proxy selection + rotation on failure
   * 3. Session-specific fingerprint + cookies
   * 4. Block & CAPTCHA detection on response
   * 5. Auto-retry with CAPTCHA solve if detected
   */
  async fetch(req: GhostRequest): Promise<GhostResponse> {
    // Rate limiting
    await this.applyRateLimit();

    // Get or create session
    const session = req.sessionId
      ? this.sessionManager.get(req.sessionId)
      : this.createSession();

    this.emit('request', req);
    this.sessionManager.recordRequest(session.id);
    this.activeRequests++;

    try {
      const response = await this.proxyRotator.withRotation(
        (exclude) => this.proxyPool.getNext(exclude),
        (proxy) => this.executeRequest(req, session, proxy),
        (proxy, error) => {
          this.proxyPool.reportFailure(proxy, new URL(req.url).hostname);
          this.emit('proxy-fail', proxy, error);
        }
      );

      const ghostResponse = response.result;

      // Report proxy success
      if (response.proxy) {
        this.proxyPool.reportSuccess(response.proxy, ghostResponse.timing.total);
      }

      // Check for blocks
      if (ghostResponse.isBlocked) {
        this.emit('block-detected', req.url, session.id);
        this.logger.warn({ url: req.url, status: ghostResponse.status }, 'Block detected');
      }

      // Check for CAPTCHA
      if (ghostResponse.captchaDetected && req.retryOnCaptcha) {
        this.logger.info('CAPTCHA detected, attempting solve...');
        this.emit('captcha-detected', ghostResponse.captchaDetected, session.id);

        try {
          const captchaResult = await this.captchaManager.solve(ghostResponse.captchaDetected);
          // Retry the request with the captcha token
          const retryReq = {
            ...req,
            headers: { ...req.headers, 'g-recaptcha-response': captchaResult.token },
          };
          return this.fetch(retryReq);
        } catch (err) {
          this.logger.error({ err }, 'CAPTCHA solve failed');
        }
      }

      this.emit('response', ghostResponse);
      return ghostResponse;
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Convenience: fetch multiple URLs with auto session management.
   */
  async fetchBatch(requests: GhostRequest[], concurrency: number = 3): Promise<GhostResponse[]> {
    const results: GhostResponse[] = [];
    const queue = [...requests];

    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const req = queue.shift();
        if (req) {
          results.push(await this.fetch(req));
        }
      }
    });

    await Promise.all(workers);
    return results;
  }

  /**
   * Get the current status of the agent.
   */
  getStatus() {
    return {
      activeSessions: this.sessionManager.list().length,
      activeRequests: this.activeRequests,
      proxyPool: this.proxyPool.getStats(),
      captchaBalance: this.captchaManager.getBalance(),
    };
  }

  /**
   * Shut down the agent: destroy all sessions, stop health checks.
   */
  destroy(): void {
    this.proxyPool.destroy();
    this.sessionManager.destroyAll();
    this.removeAllListeners();
    this.logger.info('GhostAgent destroyed');
  }

  // ─── Private ───────────────────────────────────────────────

  private async executeRequest(
    req: GhostRequest,
    session: SessionState,
    proxy: ProxyConfig | null
  ): Promise<GhostResponse> {
    const url = new URL(req.url);
    const start = performance.now();

    // Build stealth headers from session fingerprint
    const headers = buildStealthHeaders(session.fingerprint, url);

    // Merge user-provided headers
    if (req.headers) {
      Object.assign(headers, req.headers);
    }

    // Inject session cookies
    const cookieJar = this.sessionManager.getCookieJar(session.id);
    const cookieHeader = cookieJar.toHeader(url.hostname, url.pathname, url.protocol === 'https:');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    // Build fetch options
    const fetchOptions: RequestInit = {
      method: req.method ?? 'GET',
      headers,
      signal: AbortSignal.timeout(req.timeout ?? 30000),
      redirect: req.followRedirects === false ? 'manual' : 'follow',
    };

    if (req.body) {
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        fetchOptions.body = req.body;
      } else {
        fetchOptions.body = JSON.stringify(req.body);
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    // Execute the request
    const response = await fetch(req.url, fetchOptions);
    const body = await response.text();
    const buffer = Buffer.from(body);
    const totalMs = performance.now() - start;

    // Parse and store response cookies
    const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
    for (const sc of setCookieHeaders) {
      cookieJar.parseSetCookie(sc, url.hostname);
    }

    // Build response headers as plain object
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Detect block / captcha
    const isBlocked = isBlockedResponse(response.status, responseHeaders, body);
    const captchaInfo = detectCaptcha(body);
    let captchaTask: CaptchaTask | null = null;

    if (captchaInfo?.siteKey) {
      captchaTask = {
        type: captchaInfo.type === 'hcaptcha' ? 'hcaptcha'
          : captchaInfo.type === 'turnstile' ? 'turnstile'
          : 'recaptcha-v2',
        siteKey: captchaInfo.siteKey,
        siteUrl: req.url,
      };
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body,
      buffer,
      url: req.url,
      redirectChain: [],
      timing: {
        dns: 0,
        connect: 0,
        tls: 0,
        firstByte: totalMs,
        total: totalMs,
      },
      proxy,
      sessionId: session.id,
      isBlocked,
      captchaDetected: captchaTask,
    };
  }

  private async applyRateLimit(): Promise<void> {
    const { minDelay, maxDelay, humanJitter, maxConcurrent } = this.config.rateLimit;

    // Wait if too many concurrent requests
    while (this.activeRequests >= maxConcurrent) {
      await sleep(100);
    }

    // Calculate delay
    let delay = minDelay + Math.random() * (maxDelay - minDelay);

    // Add human-like jitter (Gaussian-ish)
    if (humanJitter) {
      const jitter = (Math.random() + Math.random() + Math.random()) / 3;
      delay = delay * (0.5 + jitter);
    }

    // Ensure minimum time since last request
    const elapsed = Date.now() - this.lastRequestTime;
    const waitTime = Math.max(0, delay - elapsed);

    if (waitTime > 0) {
      await sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  private async fetchProxiesFromApi(apiUrl: string): Promise<void> {
    const res = await fetch(apiUrl);
    const data = await res.json() as string[];
    const proxies = data.map(parseProxyUrl);
    this.proxyPool.addProxies(proxies);
    this.logger.info({ count: proxies.length }, 'Proxies loaded from API');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
