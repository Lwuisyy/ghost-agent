import type { BrowserFingerprint, FingerprintOptions } from '../core/types.js';

// ─── Realistic data pools ────────────────────────────────────

const CHROME_VERSIONS = ['120.0.6099.71', '121.0.6167.85', '122.0.6261.94', '123.0.6312.58', '124.0.6367.118', '125.0.6422.60', '126.0.6478.126', '127.0.6533.88', '128.0.6613.84'];
const FIREFOX_VERSIONS = ['121.0', '122.0', '123.0', '124.0', '125.0', '126.0', '127.0', '128.0'];
const SAFARI_VERSIONS = ['17.2', '17.3', '17.4', '17.5', '17.6', '18.0', '18.1'];

const WINDOWS_VERSIONS = ['10.0', '10.0']; // Win10/11 both report 10.0
const MACOS_VERSIONS = ['10_15_7', '14_0', '14_1', '14_2', '14_3', '14_4', '15_0'];
const LINUX_VERSIONS = ['x86_64'];

const SCREEN_RESOLUTIONS: [number, number][] = [
  [1920, 1080], [2560, 1440], [1366, 768], [1440, 900],
  [1536, 864], [3840, 2160], [1680, 1050], [1280, 720],
];

const LANGUAGES = ['en-US', 'en-GB', 'en-CA', 'en-AU', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN', 'id-ID'];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Asia/Tokyo',
  'Asia/Seoul', 'Asia/Jakarta', 'Australia/Sydney',
];

const WEBGL_VENDORS = ['Google Inc. (NVIDIA)', 'Google Inc. (Intel)', 'Google Inc. (AMD)', 'Google Inc. (Apple)'];
const WEBGL_RENDERERS = [
  'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'ANGLE (Intel, Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'ANGLE (AMD, AMD Radeon RX 7900 XTX Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'ANGLE (Apple, Apple M3 Pro, OpenGL 4.1)',
  'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
];

const COMMON_FONTS = [
  'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New',
  'Verdana', 'Trebuchet MS', 'Palatino', 'Impact', 'Comic Sans MS',
  'Lucida Console', 'Tahoma', 'Segoe UI', 'Calibri', 'Cambria',
];

/**
 * Generates realistic browser fingerprints that are internally consistent.
 * Each fingerprint looks like a real user's browser profile.
 */
export class FingerprintGenerator {
  /**
   * Generate a complete, internally-consistent browser fingerprint.
   */
  generate(options: FingerprintOptions = {}): BrowserFingerprint {
    const browser = options.browser ?? pick(['chrome', 'chrome', 'chrome', 'firefox', 'safari', 'edge']);
    const os = options.os ?? pick(['windows', 'windows', 'macos', 'macos', 'linux']);
    const locale = options.locale ?? pick(LANGUAGES);
    const tz = pick(TIMEZONES);

    const userAgent = this.buildUserAgent(browser, os);
    const platform = this.buildPlatform(os);
    const screen = pick(SCREEN_RESOLUTIONS);
    const colorDepth = pick([24, 24, 24, 32]);
    const hardwareConcurrency = pick([4, 6, 8, 8, 12, 16, 16, 24]);
    const deviceMemory = pick([4, 8, 8, 16, 16, 32]);

    return {
      userAgent,
      platform,
      language: locale,
      languages: [locale, locale.split('-')[0]!],
      timezone: tz,
      screenResolution: screen,
      colorDepth,
      hardwareConcurrency,
      deviceMemory,
      vendor: browser === 'chrome' || browser === 'edge' ? 'Google Inc.' : '',
      webglVendor: pick(WEBGL_VENDORS),
      webglRenderer: pick(WEBGL_RENDERERS),
      canvasHash: randomHash(32),
      audioHash: randomHash(16),
      fonts: pickMultiple(COMMON_FONTS, 8 + Math.floor(Math.random() * 5)),
      plugins: this.buildPlugins(browser),
      headers: this.buildHeaders(browser, os, locale, tz),
    };
  }

  private buildUserAgent(browser: string, os: string): string {
    const osPart = this.getOsString(os);

    switch (browser) {
      case 'chrome': {
        const ver = pick(CHROME_VERSIONS);
        return `Mozilla/5.0 (${osPart}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`;
      }
      case 'firefox': {
        const ver = pick(FIREFOX_VERSIONS);
        return `Mozilla/5.0 (${osPart}; rv:${ver}) Gecko/20100101 Firefox/${ver}`;
      }
      case 'safari': {
        const ver = pick(SAFARI_VERSIONS);
        const macVer = pick(MACOS_VERSIONS);
        return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVer}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${ver} Safari/605.1.15`;
      }
      case 'edge': {
        const ver = pick(CHROME_VERSIONS);
        return `Mozilla/5.0 (${osPart}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36 Edg/${ver}`;
      }
      default:
        return `Mozilla/5.0 (${osPart}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${pick(CHROME_VERSIONS)} Safari/537.36`;
    }
  }

  private getOsString(os: string): string {
    switch (os) {
      case 'windows': return `Windows NT ${pick(WINDOWS_VERSIONS)}; Win64; x64`;
      case 'macos': return `Macintosh; Intel Mac OS X ${pick(MACOS_VERSIONS)}`;
      case 'linux': return `X11; Linux ${pick(LINUX_VERSIONS)}`;
      case 'android': return 'Linux; Android 14; Pixel 8';
      case 'ios': return 'iPhone; CPU iPhone OS 17_5 like Mac OS X';
      default: return `Windows NT 10.0; Win64; x64`;
    }
  }

  private buildPlatform(os: string): string {
    switch (os) {
      case 'windows': return 'Win32';
      case 'macos': return 'MacIntel';
      case 'linux': return 'Linux x86_64';
      case 'android': return 'Linux armv8l';
      case 'ios': return 'iPhone';
      default: return 'Win32';
    }
  }

  private buildPlugins(browser: string): string[] {
    if (browser === 'firefox') return []; // Firefox reports no plugins
    return [
      'Chrome PDF Plugin',
      'Chrome PDF Viewer',
      'Native Client',
    ];
  }

  private buildHeaders(browser: string, os: string, locale: string, _timezone: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': `${locale},${locale.split('-')[0]};q=0.9`,
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Sec-Ch-Ua-Platform': `"${this.getPlatformName(os)}"`,
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    };

    if (browser === 'chrome' || browser === 'edge') {
      const ver = pick(CHROME_VERSIONS).split('.')[0];
      headers['Sec-Ch-Ua'] = `"Not A(Brand";v="99", "${browser === 'edge' ? 'Microsoft Edge' : 'Google Chrome'}";v="${ver}", "Chromium";v="${ver}"`;
      headers['Sec-Ch-Ua-Mobile'] = '?0';
    }

    return headers;
  }

  private getPlatformName(os: string): string {
    switch (os) {
      case 'windows': return 'Windows';
      case 'macos': return 'macOS';
      case 'linux': return 'Linux';
      case 'android': return 'Android';
      case 'ios': return 'iOS';
      default: return 'Windows';
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickMultiple<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomHash(length: number): string {
  const chars = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
