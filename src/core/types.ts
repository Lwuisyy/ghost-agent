import { z } from 'zod';

// ─── Proxy Types ─────────────────────────────────────────────

export interface ProxyConfig {
  url: string;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
  geo?: string; // ISO country code
}

export interface ProxyStats {
  totalRequests: number;
  successCount: number;
  failCount: number;
  avgLatencyMs: number;
  lastUsed: number;
  isHealthy: boolean;
  bannedDomains: Set<string>;
}

export type ProxyStrategy = 'round-robin' | 'random' | 'least-used' | 'geo-target';

// ─── Session Types ───────────────────────────────────────────

export interface SessionConfig {
  id?: string;
  ttl?: number;
  proxyConfig?: ProxyConfig;
  fingerprint?: BrowserFingerprint;
  persistCookies?: boolean;
}

export interface SessionState {
  id: string;
  createdAt: number;
  expiresAt: number;
  requestCount: number;
  cookies: CookieEntry[];
  fingerprint: BrowserFingerprint;
  proxy: ProxyConfig | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export interface CookieEntry {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  secure: boolean;
  httpOnly: boolean;
}

// ─── Browser Fingerprint Types ───────────────────────────────

export interface BrowserFingerprint {
  userAgent: string;
  platform: string;
  language: string;
  languages: string[];
  timezone: string;
  screenResolution: [number, number];
  colorDepth: number;
  hardwareConcurrency: number;
  deviceMemory: number;
  vendor: string;
  webglVendor: string;
  webglRenderer: string;
  canvasHash: string;
  audioHash: string;
  fonts: string[];
  plugins: string[];
  headers: Record<string, string>;
}

export interface FingerprintOptions {
  browser?: 'chrome' | 'firefox' | 'safari' | 'edge';
  os?: 'windows' | 'macos' | 'linux' | 'android' | 'ios';
  device?: 'desktop' | 'mobile' | 'tablet';
  locale?: string;
}

// ─── CAPTCHA Types ───────────────────────────────────────────

export type CaptchaProvider = '2captcha' | 'anti-captcha' | 'capsolver' | 'hcaptcha-token';

export interface CaptchaTask {
  type: 'recaptcha-v2' | 'recaptcha-v3' | 'hcaptcha' | 'turnstile' | 'image' | 'text';
  siteKey?: string;
  siteUrl: string;
  isInvisible?: boolean;
  action?: string; // for reCAPTCHA v3
  imageData?: string; // base64 for image captcha
}

export interface CaptchaResult {
  token: string;
  provider: CaptchaProvider;
  solveTimeMs: number;
  cost?: number;
}

// ─── Rate Limiting Types ────────────────────────────────────

export interface RateLimitConfig {
  minDelay: number;
  maxDelay: number;
  humanJitter: boolean;
  maxConcurrent: number;
  burstLimit: number;
  burstWindow: number;
}

// ─── Request Types ───────────────────────────────────────────

export interface GhostRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
  headers?: Record<string, string>;
  body?: string | Buffer | Record<string, unknown>;
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  retryOnCaptcha?: boolean;
  retryOnBlock?: boolean;
  sessionId?: string;
  proxyPreference?: ProxyConfig;
}

export interface GhostResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  buffer: Buffer;
  url: string;
  redirectChain: string[];
  timing: {
    dns: number;
    connect: number;
    tls: number;
    firstByte: number;
    total: number;
  };
  proxy: ProxyConfig | null;
  sessionId: string;
  isBlocked: boolean;
  captchaDetected: CaptchaTask | null;
}

// ─── Config Schema ──────────────────────────────────────────

export const ConfigSchema = z.object({
  proxy: z.object({
    list: z.array(z.string()).default([]),
    apiUrl: z.string().optional(),
    strategy: z.enum(['round-robin', 'random', 'least-used', 'geo-target']).default('round-robin'),
    maxRetries: z.number().min(1).default(3),
    healthCheckInterval: z.number().default(30000),
  }).default({}),

  captcha: z.object({
    provider: z.enum(['2captcha', 'anti-captcha', 'capsolver', 'hcaptcha-token']).default('2captcha'),
    apiKey: z.string().optional(),
  }).default({}),

  session: z.object({
    maxSessions: z.number().min(1).default(10),
    ttl: z.number().default(300000),
    persistCookies: z.boolean().default(false),
  }).default({}),

  rateLimit: z.object({
    minDelay: z.number().default(1000),
    maxDelay: z.number().default(5000),
    humanJitter: z.boolean().default(true),
    maxConcurrent: z.number().default(5),
    burstLimit: z.number().default(10),
    burstWindow: z.number().default(60000),
  }).default({}),

  log: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  }).default({}),
});

export type GhostAgentConfig = z.infer<typeof ConfigSchema>;
