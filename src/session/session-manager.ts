import { nanoid } from 'nanoid';
import type { SessionConfig, SessionState } from '../core/types.js';
import type { Logger } from '../utils/logger.js';
import { FingerprintGenerator } from '../browser/fingerprint.js';
import { CookieJar } from './cookie-jar.js';

/**
 * SessionManager creates and manages isolated browsing sessions.
 * Each session has its own fingerprint, cookie jar, and proxy binding.
 */
export class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private maxSessions: number,
    private defaultTtl: number,
    private fingerprintGen: FingerprintGenerator,
    private logger: Logger
  ) {
    // Periodically clean up expired sessions
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
  }

  /**
   * Create a new isolated session with unique fingerprint + cookies.
   */
  create(config: SessionConfig = {}): SessionState {
    if (this.sessions.size >= this.maxSessions) {
      // Evict the oldest session
      const oldestKey = this.sessions.keys().next().value;
      if (oldestKey) {
        this.destroy(oldestKey);
        this.logger.warn({ sessionId: oldestKey }, 'Evicted oldest session (max reached)');
      }
    }

    const id = config.id ?? nanoid(12);
    const fingerprint = config.fingerprint ?? this.fingerprintGen.generate();
    const now = Date.now();

    const session: SessionState = {
      id,
      createdAt: now,
      expiresAt: now + (config.ttl ?? this.defaultTtl),
      requestCount: 0,
      cookies: [],
      fingerprint,
      proxy: config.proxyConfig ?? null,
      isActive: true,
      metadata: {},
    };

    this.sessions.set(id, session);
    this.logger.info({ sessionId: id, fingerprint: fingerprint.userAgent.slice(0, 40) }, 'Session created');
    return session;
  }

  /** Get a session by ID. Throws if not found or expired. */
  get(id: string): SessionState {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session ${id} not found`);
    if (Date.now() > session.expiresAt) {
      this.destroy(id);
      throw new Error(`Session ${id} expired`);
    }
    return session;
  }

  /** Extend a session's TTL. */
  extend(id: string, additionalMs: number): void {
    const session = this.get(id);
    session.expiresAt += additionalMs;
  }

  /** Record a request in a session. */
  recordRequest(id: string): void {
    const session = this.get(id);
    session.requestCount++;
  }

  /** Get the cookie jar for a session. */
  getCookieJar(id: string): CookieJar {
    const session = this.get(id);
    return new CookieJar(session.cookies);
  }

  /** Destroy a session and free resources. */
  destroy(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.isActive = false;
      session.cookies = [];
      this.sessions.delete(id);
      this.logger.info({ sessionId: id, totalRequests: session.requestCount }, 'Session destroyed');
    }
  }

  /** List all active sessions. */
  list(): SessionState[] {
    return [...this.sessions.values()].filter(s => s.isActive && Date.now() < s.expiresAt);
  }

  /** Remove expired sessions. */
  private cleanup(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.destroy(id);
      }
    }
  }

  /** Destroy all sessions and stop cleanup timer. */
  destroyAll(): void {
    for (const id of this.sessions.keys()) {
      this.destroy(id);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
