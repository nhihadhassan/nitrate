import 'server-only';

import { env } from '@/env';

import type { OutboundEmail } from './types';

/**
 * Hand-written HTML rather than a rendering library: email clients want tables
 * and inline styles, the set of templates is small, and every one of these has
 * a plain-text twin so it degrades properly.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout({
  preheader,
  heading,
  body,
  ctaLabel,
  ctaUrl,
  footnote,
}: {
  preheader: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#08090b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#08090b;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0e1013;border:1px solid #24282f;border-radius:10px;">
        <tr><td style="padding:28px 28px 0;">
          <span style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#ff5b2e;font-weight:700;">Nitrate</span>
        </td></tr>
        <tr><td style="padding:16px 28px 0;">
          <h1 style="margin:0;font-size:28px;line-height:1.15;font-weight:400;color:#f4f4f5;">${heading}</h1>
        </td></tr>
        <tr><td style="padding:14px 28px 0;font-size:15px;line-height:1.6;color:#a1a7b0;">${body}</td></tr>
        ${
          ctaUrl && ctaLabel
            ? `<tr><td style="padding:24px 28px 0;">
                 <a href="${ctaUrl}" style="display:inline-block;background:#ff5b2e;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:6px;">${escapeHtml(ctaLabel)}</a>
               </td></tr>`
            : ''
        }
        <tr><td style="padding:28px;">
          <hr style="border:0;border-top:1px solid #24282f;margin:0 0 14px;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#6d7480;">
            ${footnote ? `${escapeHtml(footnote)}<br>` : ''}
            You're getting this because you're in this Movie Club on Nitrate.
            <a href="${env.siteUrl}/settings" style="color:#a1a7b0;">Manage notifications</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export type WheelWinnerPayload = {
  clubName: string;
  clubSlug: string;
  movieTitle: string;
  movieYear: number | null;
  movieSlug: string;
  runtime: string | null;
  nominatedBy: string;
  contenderCount: number;
  recipientName: string;
};

export function wheelWinnerEmail(payload: WheelWinnerPayload): OutboundEmail {
  const url = `${env.siteUrl}/club/${payload.clubSlug}`;
  const yearSuffix = payload.movieYear ? ` (${payload.movieYear})` : '';
  const title = `${payload.movieTitle}${yearSuffix}`;

  const bodyHtml = `
    <p style="margin:0 0 14px;">The wheel has spoken in <strong style="color:#f4f4f5;">${escapeHtml(payload.clubName)}</strong>.</p>
    <p style="margin:0 0 14px;">
      Out of ${payload.contenderCount} submissions, this week's film is
      <strong style="color:#f4f4f5;">${escapeHtml(title)}</strong>${
        payload.runtime ? ` — ${escapeHtml(payload.runtime)}` : ''
      }.
    </p>
    <p style="margin:0;">Submitted by ${escapeHtml(payload.nominatedBy)}. Nobody chose it — the wheel did.</p>`;

  const text = [
    `The wheel has spoken in ${payload.clubName}.`,
    ``,
    `This week's film: ${title}${payload.runtime ? ` — ${payload.runtime}` : ''}`,
    `Submitted by ${payload.nominatedBy}, picked at random from ${payload.contenderCount} submissions.`,
    ``,
    `Open the club: ${url}`,
  ].join('\n');

  return {
    to: '',
    subject: `🎬 ${payload.clubName} is watching ${title}`,
    html: layout({
      preheader: `This week's pick is ${title}`,
      heading: 'The wheel has spoken',
      body: bodyHtml,
      ctaLabel: 'Open the club',
      ctaUrl: url,
      footnote: `Picked at random from ${payload.contenderCount} submissions.`,
    }),
    text,
  };
}

export type SubmissionsOpenPayload = {
  clubName: string;
  clubSlug: string;
  closesAt: string | null;
  recipientName: string;
};

export function submissionsOpenEmail(payload: SubmissionsOpenPayload): OutboundEmail {
  const url = `${env.siteUrl}/club/${payload.clubSlug}`;
  const bodyHtml = `
    <p style="margin:0 0 14px;">Submissions are open in <strong style="color:#f4f4f5;">${escapeHtml(payload.clubName)}</strong>.</p>
    <p style="margin:0;">Put one film forward${
      payload.closesAt ? `, before ${escapeHtml(payload.closesAt)}` : ''
    }. When everyone's in, the wheel decides.</p>`;

  return {
    to: '',
    subject: `What should ${payload.clubName} watch this week?`,
    html: layout({
      preheader: 'Put a film forward before the wheel spins.',
      heading: 'Submissions are open',
      body: bodyHtml,
      ctaLabel: 'Submit a film',
      ctaUrl: url,
    }),
    text: [
      `Submissions are open in ${payload.clubName}.`,
      payload.closesAt ? `Get your pick in before ${payload.closesAt}.` : '',
      ``,
      `Submit a film: ${url}`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export type TemplateName = 'wheel_winner' | 'submissions_open';

export function renderTemplate(
  template: TemplateName,
  payload: Record<string, unknown>,
): OutboundEmail {
  switch (template) {
    case 'wheel_winner':
      return wheelWinnerEmail(payload as WheelWinnerPayload);
    case 'submissions_open':
      return submissionsOpenEmail(payload as SubmissionsOpenPayload);
  }
}
