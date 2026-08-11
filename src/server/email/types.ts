/**
 * The contract every mail transport satisfies. Nothing above this layer knows
 * whether mail leaves via Resend, another provider, or the console.
 */

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; error: string; retryable: boolean };

export interface MailTransport {
  readonly id: string;
  send(email: OutboundEmail): Promise<SendResult>;
}
