// ─── Ghost Agent ─────────────────────────────────────────────
// Anti-detection infrastructure for AI agents
// ─────────────────────────────────────────────────────────────

export { GhostAgent, type GhostAgentEvents } from './ghost-agent.js';
export { loadConfig } from './core/config.js';
export { createLogger, type Logger } from './utils/logger.js';

// Proxy
export { ProxyPool, ProxyRotator, parseProxyUrl, buildProxyUrl } from './proxy/index.js';

// Session
export { SessionManager, CookieJar } from './session/index.js';

// Browser
export { FingerprintGenerator, buildStealthHeaders, isBlockedResponse, detectCaptcha } from './browser/index.js';

// Captcha
export { CaptchaManager, TwoCaptchaSolver, AntiCaptchaSolver, type CaptchaSolver } from './captcha/index.js';

// Types
export type {
  GhostAgentConfig,
  GhostRequest,
  GhostResponse,
  ProxyConfig,
  ProxyStats,
  ProxyStrategy,
  SessionConfig,
  SessionState,
  CookieEntry,
  BrowserFingerprint,
  FingerprintOptions,
  CaptchaProvider,
  CaptchaTask,
  CaptchaResult,
  RateLimitConfig,
} from './core/types.js';
