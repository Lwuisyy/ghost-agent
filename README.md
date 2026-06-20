<div align="center">

```
    ░██████╗░░██╗░░██╗░░░██████╗░░███████╗░████████╗
    ██╔════╝░░██║░░██║░██╔════╝░░██╔════╝░╚══██╔══╝
    ██║░░██╗░░███████║░╚█████╗░░░███████╗░░░░██║░░░
    ██║░░╚██╗░██╔══██║░░╚═══██╗░░╚════██║░░░░██║░░░
    ╚██████╔╝░██║░░██║░██████╔╝░░███████║░░░░██║░░░
    ░╚═════╝░░╚═╝░░╚═╝░╚═════╝░░╚══════╝░░░░╚═╝░░░
                    A G E N T
```

### 👻 Anti-Detection Infrastructure for AI Agents

*They see pages. We see through walls.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Node](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-888?style=flat-square)](LICENSE)

</div>

---

## The Invisible Problem

Every day, thousands of AI agents hit the same wall:

> `403 Forbidden — Access Denied`

CAPTCHAs. IP bans. Fingerprint detection. Bot traps. The web was built for humans, and it knows when you're not one.

**Ghost Agent** makes your AI agents invisible. Not by hiding — by becoming indistinguishable from real users.

---

## 👁️ What Ghost Sees

```
┌─────────────────────────────────────────────────────────┐
│                    GHOST AGENT                          │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Proxy    │  │  Session │  │ Browser  │              │
│  │  Phantom  │  │  Wraith  │  │  Mask    │              │
│  │          │  │          │  │          │              │
│  │ 4 strat  │  │ isolated │  │ realistic│              │
│  │ auto-heal│  │ cookies  │  │ fingerprint│            │
│  │ geo-route│  │ dispose  │  │ stealth  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ CAPTCHA  │  │  Rate    │  │  Block   │              │
│  │  Breaker │  │  Mimic   │  │  Sense   │              │
│  │          │  │          │  │          │              │
│  │ reCAPTCHA│  │ human    │  │ Cloudflare│             │
│  │ hCaptcha │  │ jitter   │  │ DataDome │              │
│  │ Turnstile│  │ gaussian │  │ PerimeterX│             │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## ⚡ Possession (Quick Start)

```bash
# Summon
git clone https://github.com/Lwuisyy/ghost-agent.git
cd ghost-agent
npm install

# Configure your proxies + CAPTCHA keys
cp .env.example .env
```

```typescript
import { GhostAgent } from 'ghost-agent';

const ghost = new GhostAgent();
await ghost.init();

// A new identity materializes
const session = ghost.createSession();

// Walk through walls
const res = await ghost.fetch({
  url: 'https://protected-site.com',
  sessionId: session.id,
  retryOnCaptcha: true,
});

console.log(res.status); // 200 👻

// Vanish
ghost.destroy();
```

---

## 🔮 The Six Masks

### 1. Proxy Phantom

```
    ┌───┐     ┌───┐     ┌───┐     ┌───┐
    │ P1│────▶│ P2│────▶│ P3│────▶│ P1│  round-robin
    └───┘     └───┘     └───┘     └───┘

    ┌───┐  ✗  ┌───┐     ┌───┐
    │ P1│────▶│ P2│────▶│ P3│          auto-retry on failure
    └───┘     └───┘     └───┘
```

Four rotation strategies: `round-robin`, `random`, `least-used`, `geo-target`.
Dead proxies are automatically quarantined. Health checks run in the background.

### 2. Session Wraith

Each session is a **completely separate identity** — unique fingerprint, isolated cookie jar, dedicated proxy binding. When a session expires, every trace vanishes with it.

```typescript
const alice = ghost.createSession();
const bob   = ghost.createSession();

alice.fingerprint.userAgent !== bob.fingerprint.userAgent  // true
alice.fingerprint.canvasHash !== bob.fingerprint.canvasHash // true
// Same agent. Two ghosts.
```

### 3. Browser Mask

Generates **internally consistent** browser fingerprints. Not random noise — realistic profiles where every detail matches:

| Layer | What's Masked |
|---|---|
| User-Agent | Chrome 120–128, Firefox 121–128, Safari 17–18, Edge |
| Platform | Windows, macOS, Linux (consistent with UA) |
| WebGL | Realistic GPU vendors + renderers |
| Canvas | Unique but stable hash per session |
| Audio | AudioContext fingerprint |
| Fonts | Plausible installed font lists |
| Headers | Sec-Ch-Ua, Sec-Fetch, proper ordering |
| Timezone | Matched to proxy geo when available |

### 4. CAPTCHA Breaker

Unified solver for the big three. Auto-detects challenges in responses and solves them transparently:

```typescript
// You don't call this. Ghost does.
ghost.on('captcha-detected', (task, session) => {
  // reCAPTCHA v2/v3 • hCaptcha • Cloudflare Turnstile
  console.log(`Breaking ${task.type} for session ${session}...`);
});
```

Supports **2captcha** and **anti-captcha** with automatic fallback.

### 5. Rate Mimic

Humans don't send 47 requests per second. Ghost doesn't either:

```typescript
rateLimit: {
  minDelay: 1000,      // minimum pause
  maxDelay: 5000,      // maximum pause
  humanJitter: true,   // gaussian distribution
  maxConcurrent: 3,    // parallel limit
}
```

Delays follow a **Gaussian-like distribution** — not uniform, not predictable. Just like a real person scrolling.

### 6. Block Sense

Ghost knows when it's been spotted:

```typescript
ghost.on('block-detected', (url, session) => {
  // Cloudflare challenge page
  // DataDome / PerimeterX WAF
  // Generic 403 / "Access Denied"
  // "Just a moment..." interstitial
});
```

---

## 👻 Haunt at Scale

```typescript
// 50 URLs. 5 concurrent ghosts. Each with their own identity.
const results = await ghost.fetchBatch(
  urls.map(url => ({ url, retryOnCaptcha: true })),
  5
);
```

---

## 🕯️ Séance (Events)

```typescript
ghost.on('request',          (req) => { /* outgoing request */ });
ghost.on('response',         (res) => { /* incoming response */ });
ghost.on('block-detected',   (url, session) => { /* we've been spotted */ });
ghost.on('captcha-detected', (task, session) => { /* challenge ahead */ });
ghost.on('proxy-fail',       (proxy, err) => { /* proxy is dead */ });
ghost.on('session-created',  (session) => { /* new ghost born */ });
ghost.on('session-destroyed',(id) => { /* ghost vanished */ });
```

---

## 🗝️ Configuration

Every setting works through environment variables or constructor options:

```env
# ── Proxies ──
PROXY_LIST=http://user:pass@proxy1.com:8080,socks5://proxy2.com:1080
PROXY_STRATEGY=round-robin          # round-robin | random | least-used | geo-target
PROXY_MAX_RETRIES=3
PROXY_HEALTH_CHECK_INTERVAL=30000

# ── CAPTCHA ──
CAPTCHA_PROVIDER=2captcha           # 2captcha | anti-captcha | capsolver
CAPTCHA_API_KEY=your-key

# ── Sessions ──
MAX_SESSIONS=10
SESSION_TTL=300000

# ── Rate Limit ──
RATE_LIMIT_MIN_DELAY=1000
RATE_LIMIT_MAX_DELAY=5000
HUMAN_JITTER=true

# ── Logging ──
LOG_LEVEL=info                      # trace | debug | info | warn | error
```

---

## 📜 The Ritual (Examples)

```bash
# Web scraping through haunted proxies
npm run example:scrape

# API testing with multiple ghost identities
npm run example:api

# Run the smoke test séance
npx tsx tests/smoke-test.ts
```

---

## 🗺️ The Roadmap

| Status | Feature |
| :---: | --- |
| ◻️ | **TLS fingerprint masking** (JA3/JA4) — spoof the TLS handshake itself |
| ◻️ | **Playwright / Puppeteer bridge** — real browser automation with ghost stealth |
| ◻️ | **Proxy provider APIs** — BrightData, Oxylabs, Smartproxy auto-integration |
| ◻️ | **Session persistence** — save & restore ghost identities across restarts |
| ◻️ | **Cloudflare challenge auto-solver** — bypass the "Just a moment..." wall |
| ◻️ | **Residential proxy auto-rotation** — per-domain residential IP cycling |
| ◻️ | **Request/response recording** — full trajectory capture for debugging |
| ◻️ | **MCP server** — let AI agents (Claude, Cursor, etc.) invoke ghost as a tool |

*Want to contribute? Pick an item, open a PR, and join the haunting.*

---

## 🪦 License

MIT — *Use it. Fork it. Haunt the web with it.*

---

<div align="center">

```
        .-.
       (o o) boo!
       | O |
      _|   |_
     / |   | \
    /  |   |  \
       '---'

  made for agents that refuse to be seen
```

</div>
