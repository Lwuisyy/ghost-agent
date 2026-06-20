import type { CaptchaTask, CaptchaResult } from '../core/types.js';
import type { CaptchaSolver } from './solver.js';

const API_BASE = 'https://api.anti-captcha.com';

/**
 * anti-captcha.com solver integration.
 */
export class AntiCaptchaSolver implements CaptchaSolver {
  constructor(private apiKey: string) {}

  async solve(task: CaptchaTask): Promise<CaptchaResult> {
    const start = Date.now();
    const taskId = await this.createTask(task);
    const token = await this.pollResult(taskId);

    return {
      token,
      provider: 'anti-captcha',
      solveTimeMs: Date.now() - start,
    };
  }

  async getBalance(): Promise<number> {
    const res = await fetch(`${API_BASE}/getBalance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: this.apiKey }),
    });
    const data = await res.json() as { errorId: number; balance: number };
    if (data.errorId !== 0) throw new Error(`Anti-captcha balance check failed`);
    return data.balance;
  }

  private async createTask(task: CaptchaTask): Promise<number> {
    let taskBody: Record<string, unknown>;

    switch (task.type) {
      case 'recaptcha-v2':
        taskBody = {
          type: task.isInvisible ? 'RecaptchaV2TaskProxyless' : 'RecaptchaV2TaskProxyless',
          websiteURL: task.siteUrl,
          websiteKey: task.siteKey,
          isInvisible: task.isInvisible ?? false,
        };
        break;
      case 'recaptcha-v3':
        taskBody = {
          type: 'RecaptchaV3TaskProxyless',
          websiteURL: task.siteUrl,
          websiteKey: task.siteKey,
          pageAction: task.action,
        };
        break;
      case 'hcaptcha':
        taskBody = {
          type: 'HCaptchaTaskProxyless',
          websiteURL: task.siteUrl,
          websiteKey: task.siteKey,
        };
        break;
      case 'turnstile':
        taskBody = {
          type: 'TurnstileTaskProxyless',
          websiteURL: task.siteUrl,
          websiteKey: task.siteKey,
        };
        break;
      default:
        throw new Error(`Unsupported captcha type: ${task.type}`);
    }

    const res = await fetch(`${API_BASE}/createTask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: this.apiKey, task: taskBody }),
    });

    const data = await res.json() as { errorId: number; taskId: number; errorDescription?: string };
    if (data.errorId !== 0) throw new Error(`Anti-captcha create failed: ${data.errorDescription}`);
    return data.taskId;
  }

  private async pollResult(taskId: number, maxAttempts: number = 30): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(3000);

      const res = await fetch(`${API_BASE}/getTaskResult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientKey: this.apiKey, taskId }),
      });

      const data = await res.json() as {
        errorId: number;
        status: string;
        solution?: { gRecaptchaResponse?: string; token?: string };
        errorDescription?: string;
      };

      if (data.errorId !== 0) throw new Error(`Anti-captcha error: ${data.errorDescription}`);
      if (data.status === 'processing') continue;

      if (data.status === 'ready') {
        return data.solution?.gRecaptchaResponse ?? data.solution?.token ?? '';
      }
    }

    throw new Error('Anti-captcha: max polling attempts reached');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
