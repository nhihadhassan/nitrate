import 'server-only';

import { env } from '@/env';

import type { MailTransport, OutboundEmail, SendResult } from './types';

/**
 * Resend. Chosen because it needs one API key and one verified domain, with no
 * SDK — a plain fetch keeps the dependency count at zero.
 */
class ResendTransport implements MailTransport {
  readonly id = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(email: OutboundEmail): Promise<SendResult> {
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      // Network-level failures are always worth retrying.
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Network error',
        retryable: true,
      };
    }

    if (response.ok) {
      const body = (await response.json().catch(() => null)) as { id?: string } | null;
      return { ok: true, providerMessageId: body?.id ?? null };
    }

    const detail = (await response.text().catch(() => '')).slice(0, 300);
    return {
      ok: false,
      error: `Resend ${response.status}: ${detail}`,
      // 4xx means the request itself is wrong; retrying will not fix it.
      retryable: response.status === 429 || response.status >= 500,
    };
  }
}

/**
 * Development fallback. Mail still moves through the full queue and is visible
 * in the admin outbox — it just prints instead of leaving the building, so the
 * feature is fully testable without credentials.
 */
class ConsoleTransport implements MailTransport {
  readonly id = 'console';

  async send(email: OutboundEmail): Promise<SendResult> {
    console.info(
      `[email:console] to=${email.to} subject="${email.subject}"\n${email.text.slice(0, 400)}`,
    );
    return { ok: true, providerMessageId: null };
  }
}

export function mailTransport(): MailTransport {
  const key = env.resendApiKey;
  return key ? new ResendTransport(key, env.emailFrom) : new ConsoleTransport();
}

export function emailIsConfigured(): boolean {
  return Boolean(env.resendApiKey);
}
