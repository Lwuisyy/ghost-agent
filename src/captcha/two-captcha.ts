import type { CaptchaTask, CaptchaResult } from '../core/types.js';
import type { CaptchaSolver } from './solver.js';

const API_BASE = 'https://api.2captcha.com';

/**
 * 2captcha.com solver integration.
 * Supports reCAPTCHA v2/v3, hCaptcha, Turnstile, image, and text CAPTCHAs.
 */
export class TwoCaptchaSolver implements CaptchaSolver {
  constructor(private apiKey: string) {}

  async solve(task: CaptchaTask): Promise<CaptchaResult> {
    const start = Date.now();

    // Step 1: Create the task
    const taskId = await this.createTask(task);

    // Step 2: Poll for result
    const token = await this.pollResult(taskId);

    return {
      token,
      provider: '2captcha',
      solveTimeMs: Date.now() - start,
    };
  }

  async getBalance(): Promise<number> {
    const res = await fetch(`${API_BASE}/res.php?key=${this.apiKey}&action=getbalance&json=1`);
    const data = await res.json() as { status: number; request: string };
    if (data.status !== 1) throw new Error(`2captcha balance check failed: ${data.request}`);
    return parseFloat(data.request);
  }

  private async createTask(task: CaptchaTask): Promise<string> {
    const body: Record<string, string> = {
      key: this.apiKey,
      json: '1',
      pageurl: task.siteUrl,
    };

    switch (task.type) {
      case 'recaptcha-v2':
        body.method = 'userrecaptcha';
        body.googlekey = task.siteKey ?? '';
        if (task.isInvisible) body.invisible = '1';
        break;
      case 'recaptcha-v3':
        body.method = 'userrecaptcha';
        body.googlekey = task.siteKey ?? '';
        body.version = 'v3';
        if (task.action) body.action = task.action;
        break;
      case 'hcaptcha':
        body.method = 'hcaptcha';
        body.sitekey = task.siteKey ?? '';
        break;
      case 'turnstile':
        body.method = 'turnstile';
        body.sitekey = task.siteKey ?? '';
        break;
      case 'image':
        body.method = 'base64';
        body.body = task.imageData ?? '';
        break;
      default:
        throw new Error(`Unsupported captcha type: ${task.type}`);
    }

    const res = await fetch(`${API_BASE}/in.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json() as { status: number; request: string };
    if (data.status !== 1) throw new Error(`2captcha create failed: ${data.request}`);
    return data.request;
  }

  private async pollResult(taskId: string, maxAttempts: number = 30): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(3000); // 2captcha recommends 3s polling interval

      const res = await fetch(`${API_BASE}/res.php?key=${this.apiKey}&action=get&id=${taskId}&json=1`);
      const data = await res.json() as { status: number; request: string };

      if (data.request === 'CAPCHA_NOT_READY') continue;
      if (data.status === 1) return data.request;

      throw new Error(`2captcha solve error: ${data.request}`);
    }

    throw new Error('2captcha: max polling attempts reached');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
