import type { CookieEntry } from '../core/types.js';

/**
 * Lightweight cookie jar for per-session cookie management.
 * Handles set, get, serialize, and expiration.
 */
export class CookieJar {
  private cookies: Map<string, CookieEntry> = new Map();

  constructor(initial?: CookieEntry[]) {
    if (initial) {
      for (const cookie of initial) {
        this.set(cookie);
      }
    }
  }

  /** Set or update a cookie. */
  set(cookie: CookieEntry): void {
    const key = `${cookie.domain}|${cookie.path}|${cookie.name}`;
    this.cookies.set(key, cookie);
  }

  /** Parse and store a Set-Cookie header value. */
  parseSetCookie(header: string, requestDomain: string): void {
    const parts = header.split(';').map(p => p.trim());
    if (parts.length === 0) return;

    const [nameValue, ...attributes] = parts;
    const eqIdx = nameValue!.indexOf('=');
    if (eqIdx === -1) return;

    const name = nameValue!.slice(0, eqIdx).trim();
    const value = nameValue!.slice(eqIdx + 1).trim();

    const cookie: CookieEntry = {
      name,
      value,
      domain: requestDomain,
      path: '/',
      expires: 0,
      secure: false,
      httpOnly: false,
    };

    for (const attr of attributes) {
      const [key, val] = attr.split('=').map(s => s.trim());
      const lowerKey = key?.toLowerCase();

      switch (lowerKey) {
        case 'domain':
          cookie.domain = val?.startsWith('.') ? val.slice(1) : (val ?? requestDomain);
          break;
        case 'path':
          cookie.path = val ?? '/';
          break;
        case 'expires':
          cookie.expires = val ? new Date(val).getTime() : 0;
          break;
        case 'max-age':
          cookie.expires = val ? Date.now() + Number(val) * 1000 : 0;
          break;
        case 'secure':
          cookie.secure = true;
          break;
        case 'httponly':
          cookie.httpOnly = true;
          break;
      }
    }

    this.set(cookie);
  }

  /** Get all non-expired cookies for a domain + path. */
  get(domain: string, path: string = '/', secure: boolean = false): CookieEntry[] {
    const now = Date.now();
    const results: CookieEntry[] = [];

    for (const cookie of this.cookies.values()) {
      // Check expiration
      if (cookie.expires > 0 && now > cookie.expires) continue;

      // Check domain match
      if (!domain.endsWith(cookie.domain) && cookie.domain !== domain) continue;

      // Check path match
      if (!path.startsWith(cookie.path)) continue;

      // Check secure flag
      if (cookie.secure && !secure) continue;

      results.push(cookie);
    }

    return results;
  }

  /** Build a Cookie header string for a request. */
  toHeader(domain: string, path: string = '/', secure: boolean = false): string {
    const cookies = this.get(domain, path, secure);
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }

  /** Get all cookies as array. */
  all(): CookieEntry[] {
    return [...this.cookies.values()];
  }

  /** Clear all cookies. */
  clear(): void {
    this.cookies.clear();
  }

  /** Clear cookies for a specific domain. */
  clearDomain(domain: string): void {
    for (const [key, cookie] of this.cookies) {
      if (cookie.domain === domain) {
        this.cookies.delete(key);
      }
    }
  }
}
