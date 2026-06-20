import type { BrowserFingerprint } from '../core/types.js';

/**
 * Builds a complete, stealth-optimized header set from a fingerprint.
 * Handles header ordering (critical for TLS fingerprint detection)
 * and adds anti-detection headers.
 */
export function buildStealthHeaders(fp: BrowserFingerprint, url: URL): Record<string, string> {
  const headers: Record<string, string> = {
    ...fp.headers,
    'User-Agent': fp.userAgent,
    'Host': url.host,
    'Connection': 'keep-alive',
  };

  // Add referer if navigating from a search engine (looks organic)
  if (Math.random() > 0.6) {
    const searchEngines = [
      `https://www.google.com/search?q=${encodeURIComponent(randomQuery())}`,
      `https://www.bing.com/search?q=${encodeURIComponent(randomQuery())}`,
      'https://www.google.com/',
      'https://www.reddit.com/',
    ];
    headers['Referer'] = searchEngines[Math.floor(Math.random() * searchEngines.length)]!;
  }

  return headers;
}

/**
 * Check if a response indicates bot detection.
 */
export function isBlockedResponse(status: number, headers: Record<string, string>, body: string): boolean {
  // Common block status codes
  if (status === 403 || status === 429 || status === 406) return true;

  // Cloudflare challenge page
  if (body.includes('cf-challenge') || body.includes('challenge-platform')) return true;

  // DataDome / PerimeterX / other WAF
  if (body.includes('dd-captcha') || body.includes('px-captcha')) return true;

  // Akamai bot manager
  if (headers['x-akamai-bot-notice']) return true;

  // Generic block indicators
  if (body.includes('Access Denied') || body.includes('Just a moment...')) return true;
  if (body.includes('Please verify you are a human')) return true;

  return false;
}

/**
 * Detect if a CAPTCHA is present in the response.
 */
export function detectCaptcha(body: string): { type: string; siteKey?: string } | null {
  // reCAPTCHA v2/v3
  const recaptchaMatch = body.match(/sitekey["\s:=]+["']?([a-zA-Z0-9_-]{40})["']?/);
  if (recaptchaMatch) {
    return { type: 'recaptcha', siteKey: recaptchaMatch[1] };
  }

  // hCaptcha
  const hcaptchaMatch = body.match(/data-sitekey=["']?([a-f0-9-]{36})["']?/);
  if (hcaptchaMatch && body.includes('hcaptcha.com')) {
    return { type: 'hcaptcha', siteKey: hcaptchaMatch[1] };
  }

  // Cloudflare Turnstile
  const turnstileMatch = body.match(/data-sitekey=["']?([a-zA-Z0-9_-]{42})["']?/);
  if (turnstileMatch && body.includes('turnstile')) {
    return { type: 'turnstile', siteKey: turnstileMatch[1] };
  }

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────

const SEARCH_QUERIES = [
  'best laptop 2026', 'how to learn typescript', 'weather today',
  'recipe pasta carbonara', 'nodejs tutorial', 'python vs javascript',
  'open source projects', 'machine learning course', 'web development tips',
];

function randomQuery(): string {
  return SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)]!;
}
