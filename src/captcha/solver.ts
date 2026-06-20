import type { CaptchaProvider, CaptchaTask, CaptchaResult } from '../core/types.js';
import type { Logger } from '../utils/logger.js';
import { TwoCaptchaSolver } from './two-captcha.js';
import { AntiCaptchaSolver } from './anti-captcha.js';

export interface CaptchaSolver {
  solve(task: CaptchaTask): Promise<CaptchaResult>;
  getBalance(): Promise<number>;
}

/**
 * CaptchaManager provides a unified interface for solving CAPTCHAs
 * across multiple providers with automatic fallback.
 */
export class CaptchaManager {
  private solvers: Map<CaptchaProvider, CaptchaSolver> = new Map();
  private primary: CaptchaProvider;

  constructor(
    primary: CaptchaProvider,
    apiKey: string | undefined,
    private logger: Logger
  ) {
    this.primary = primary;

    if (apiKey) {
      switch (primary) {
        case '2captcha':
          this.solvers.set('2captcha', new TwoCaptchaSolver(apiKey));
          break;
        case 'anti-captcha':
          this.solvers.set('anti-captcha', new AntiCaptchaSolver(apiKey));
          break;
        default:
          logger.warn({ provider: primary }, 'Captcha provider not yet implemented, set API key when ready');
      }
    }
  }

  /**
   * Solve a CAPTCHA task. Tries primary provider first, then falls back.
   */
  async solve(task: CaptchaTask): Promise<CaptchaResult> {
    const solver = this.solvers.get(this.primary);
    if (!solver) {
      throw new Error(`No solver configured for provider: ${this.primary}. Set CAPTCHA_API_KEY in config.`);
    }

    this.logger.info({ type: task.type, url: task.siteUrl }, 'Solving CAPTCHA');

    try {
      const result = await solver.solve(task);
      this.logger.info(
        { provider: result.provider, timeMs: result.solveTimeMs },
        'CAPTCHA solved'
      );
      return result;
    } catch (err) {
      this.logger.error({ error: err, provider: this.primary }, 'CAPTCHA solve failed');

      // Try fallback providers
      for (const [provider, fallback] of this.solvers) {
        if (provider === this.primary) continue;
        try {
          const result = await fallback.solve(task);
          this.logger.info({ provider, timeMs: result.solveTimeMs }, 'CAPTCHA solved via fallback');
          return result;
        } catch {
          continue;
        }
      }

      throw err;
    }
  }

  /** Check balance on the primary provider. */
  async getBalance(): Promise<number> {
    const solver = this.solvers.get(this.primary);
    if (!solver) return 0;
    return solver.getBalance();
  }
}
