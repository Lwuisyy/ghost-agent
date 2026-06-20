# 👻 Ghost Agent

> Anti-detection infrastructure for AI agents — proxy rotation, browser fingerprinting, session isolation, and CAPTCHA solving.

## The Problem

AI agents that need to browse the web (scraping, testing, automation) constantly get blocked by:
- 🛡️ CAPTCHAs (reCAPTCHA, hCaptcha, Turnstile)
- 🚫 IP-based rate limiting and bans
- 🔍 Browser fingerprint detection
- 🍪 Cookie/session tracking

Ghost Agent provides a unified, composable toolkit to handle all of this transparently.

## Features

| Feature | Description |
|---|---|
| **Proxy Rotation** | Pool management with round-robin, random, least-used, and geo-target strategies. Auto health checks. |
| **Session Isolation** | Each session gets its own fingerprint, cookie jar, and proxy binding. Sessions are disposable and auto-expiring. |
| **Browser Fingerprinting** | Generates realistic, internally-consistent fingerprints (UA, WebGL, Canvas, Audio, fonts, headers). |
| **Stealth Headers** | Properly ordered Sec-Ch-Ua headers, realistic Accept headers, optional search engine referers. |
| **CAPTCHA Solving** | Unified interface for 2captcha and anti-captcha, with auto-retry on detection. |
| **Rate Limiting** | Human-like delays with Gaussian jitter, configurable concurrency limits. |
| **Block Detection** | Automatically detects Cloudflare challenges, DataDome, PerimeterX, and generic blocks. |
| **Event System** | Listen for blocks, CAPTCHAs, proxy failures, and session lifecycle events. |

## Quick Start

```bash
npm install
cp .env.example .env  # Configure your proxies + CAPTCHA API key
npm run build
```

```typescript
import { GhostAgent } from 'ghost-agent';

const ghost = new GhostAgent({
  proxy: {
    list: ['http://user:pass@proxy1.com:8080', 'http://proxy2.com:3128'],
    strategy: 'round-robin',
  },
  rateLimit: { minDelay: 1000, maxDelay: 3000, humanJitter: true },
});

await ghost.init();

// Create an isolated session
const session = ghost.createSession();

// Make a stealth request
const res = await ghost.fetch({
  url: 'https://example.com',
  sessionId: session.id,
  retryOnCaptcha: true,
});

console.log(res.status, res.body.slice(0, 100));

// Cleanup
ghost.destroy();
```

## Architecture

```
GhostAgent (Orchestrator)
├── ProxyPool        → manages proxy list, health, rotation strategies
├── ProxyRotator     → auto-retry with next proxy on failure
├── SessionManager   → creates isolated sessions with unique identities
│   ├── CookieJar    → per-session cookie management
│   └── Fingerprint  → unique browser fingerprint per session
├── CaptchaManager   → unified CAPTCHA solving (2captcha, anti-captcha)
└── RateLimiter      → human-like delays between requests
```

## Session Isolation

Each session is a completely independent "browser identity":

```typescript
// Two users, two identities — different fingerprints, cookies, everything
const alice = ghost.createSession();
const bob = ghost.createSession();

// Alice and Bob have different User-Agents, WebGL, Canvas hashes, etc.
console.log(alice.fingerprint.userAgent !== bob.fingerprint.userAgent); // true

// Requests maintain separate cookie jars
await ghost.fetch({ url: 'https://site.com/login', sessionId: alice.id });
await ghost.fetch({ url: 'https://site.com/login', sessionId: bob.id });

// Dispose when done
ghost.destroySession(alice.id);
ghost.destroySession(bob.id);
```

## Proxy Strategies

| Strategy | Behavior |
|---|---|
| `round-robin` | Cycles through healthy proxies in order |
| `random` | Picks a random healthy proxy |
| `least-used` | Picks the proxy with fewest total requests |
| `geo-target` | Prefers proxies matching a target country |

```typescript
const ghost = new GhostAgent({
  proxy: {
    list: proxies,
    strategy: 'geo-target', // Target specific country
  },
});
```

## CAPTCHA Solving

Supports reCAPTCHA v2/v3, hCaptcha, and Cloudflare Turnstile:

```typescript
const ghost = new GhostAgent({
  captcha: { provider: '2captcha', apiKey: 'your-key' },
});

// Auto-detect and solve CAPTCHAs
const res = await ghost.fetch({
  url: 'https://protected-site.com',
  retryOnCaptcha: true, // Will auto-solve and retry
});
```

## Event Handling

```typescript
ghost.on('block-detected', (url, session) => {
  console.log(`Blocked on ${url}, switching proxy...`);
});

ghost.on('captcha-detected', (task, session) => {
  console.log(`CAPTCHA: ${task.type} at ${task.siteUrl}`);
});

ghost.on('proxy-fail', (proxy, error) => {
  console.log(`Proxy ${proxy.host} failed: ${error.message}`);
});
```

## Batch Requests

```typescript
const results = await ghost.fetchBatch(
  urls.map(url => ({ url, sessionId: session.id })),
  3 // concurrency
);
```

## Configuration

All settings via environment variables or constructor options:

```env
PROXY_LIST=http://proxy1:8080,http://proxy2:3128
PROXY_STRATEGY=round-robin
PROXY_MAX_RETRIES=3
CAPTCHA_PROVIDER=2captcha
CAPTCHA_API_KEY=your-key-here
MAX_SESSIONS=10
SESSION_TTL=300000
RATE_LIMIT_MIN_DELAY=1000
RATE_LIMIT_MAX_DELAY=5000
HUMAN_JITTER=true
LOG_LEVEL=info
```

## Running Examples

```bash
# Web scraping demo
npm run example:scrape

# API testing demo
npm run example:api
```

## Roadmap

- [ ] TLS fingerprint masking (JA3/JA4)
- [ ] Browser automation integration (Playwright/Puppeteer bridge)
- [ ] Proxy provider integrations (BrightData, Oxylabs, Smartproxy APIs)
- [ ] Session persistence (save/restore across restarts)
- [ ] Cloudflare challenge auto-solver
- [ ] Residential proxy auto-rotation per domain
- [ ] Request/response recording for debugging
- [ ] MCP server for AI agent integration

## License

MIT
