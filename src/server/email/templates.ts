import 'server-only';

import { BRAND } from '@/lib/brand';
import { env } from '@/env';
import { inlineSelectionLabel } from '@/lib/club-cadence';

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
          <span style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#ff5b2e;font-weight:700;">${escapeHtml(BRAND.short)}</span>
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
            You're getting this because you're a member of ${escapeHtml(BRAND.name)}.
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
  selectionMovieLabel?: string;
};

export function wheelWinnerEmail(payload: WheelWinnerPayload): OutboundEmail {
  const url = `${env.siteUrl}/club/${payload.clubSlug}`;
  const bodyHtml = `
    <p style="margin:0 0 14px;">The wheel has been spun in <strong style="color:#f4f4f5;">${escapeHtml(payload.clubName)}</strong>.</p>
    <p style="margin:0;">Open Movie Club when you’re ready to reveal ${escapeHtml(inlineSelectionLabel(payload.selectionMovieLabel ?? 'this selection’s movie'))}, chosen from ${payload.contenderCount} picks.</p>`;

  const text = [
    `The wheel has spoken in ${payload.clubName}.`,
    ``,
    `Open Movie Club when you're ready to reveal ${inlineSelectionLabel(payload.selectionMovieLabel ?? 'this selection’s movie')}, chosen at random from ${payload.contenderCount} picks.`,
    ``,
    `Open the club: ${url}`,
  ].join('\n');

  return {
    to: '',
    subject: `🎬 The Movie Club wheel is ready in ${payload.clubName}`,
    html: layout({
      preheader: 'Your Movie Club reveal is ready.',
      heading: 'The wheel has spoken',
      body: bodyHtml,
      ctaLabel: 'Open the club',
      ctaUrl: url,
      footnote: `Chosen at random from ${payload.contenderCount} picks.`,
    }),
    text,
  };
}

export type SubmissionsOpenPayload = {
  clubName: string;
  clubSlug: string;
  closesAt: string | null;
  recipientName: string;
  selectionMovieLabel?: string;
};

export function submissionsOpenEmail(payload: SubmissionsOpenPayload): OutboundEmail {
  const url = `${env.siteUrl}/club/${payload.clubSlug}`;
  const bodyHtml = `
    <p style="margin:0 0 14px;"><strong style="color:#f4f4f5;">${escapeHtml(payload.clubName)}</strong> is choosing the next movie.</p>
    <p style="margin:0;">Pick your movie${
      payload.closesAt ? `, before ${escapeHtml(payload.closesAt)}` : ''
    }. When everyone's in, the wheel decides.</p>`;

  return {
    to: '',
    subject: `What should ${payload.clubName} choose for ${inlineSelectionLabel(payload.selectionMovieLabel ?? 'this selection')}?`,
    html: layout({
      preheader: 'Pick your movie before the wheel spins.',
      heading: 'Pick your movie',
      body: bodyHtml,
      ctaLabel: 'Pick my movie',
      ctaUrl: url,
    }),
    text: [
      `${payload.clubName} is choosing the next movie.`,
      payload.closesAt ? `Get your pick in before ${payload.closesAt}.` : '',
      ``,
      `Pick your movie: ${url}`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export type ScreeningReminderPayload = {
  clubName: string;
  clubSlug: string;
  screeningId: string;
  movieTitle: string;
  when: string;
  location: string | null;
  recipientName: string;
};

export function screeningReminderEmail(payload: ScreeningReminderPayload): OutboundEmail {
  const url = `${env.siteUrl}/club/${payload.clubSlug}/screening/${payload.screeningId}`;
  const bodyHtml = `
    <p style="margin:0 0 14px;"><strong style="color:#f4f4f5;">${escapeHtml(payload.movieTitle)}</strong> is coming up in ${escapeHtml(payload.clubName)}.</p>
    <p style="margin:0;">${escapeHtml(payload.when)}${payload.location ? `<br>${escapeHtml(payload.location)}` : ''}</p>`;
  return {
    to: '',
    subject: `${payload.movieTitle} is coming up`,
    html: layout({
      preheader: `Movie night is coming up: ${payload.movieTitle}`,
      heading: 'Movie night is coming up',
      body: bodyHtml,
      ctaLabel: 'Open movie night',
      ctaUrl: url,
    }),
    text: [
      `${payload.movieTitle} is coming up in ${payload.clubName}.`,
      payload.when,
      payload.location ?? '',
      '',
      `Open movie night: ${url}`,
    ].filter(Boolean).join('\n'),
  };
}

export type TemplateName = 'wheel_winner' | 'submissions_open' | 'screening_reminder';

export function renderTemplate(
  template: TemplateName,
  payload: Record<string, unknown>,
): OutboundEmail {
  switch (template) {
    case 'wheel_winner':
      return wheelWinnerEmail(payload as WheelWinnerPayload);
    case 'submissions_open':
      return submissionsOpenEmail(payload as SubmissionsOpenPayload);
    case 'screening_reminder':
      return screeningReminderEmail(payload as ScreeningReminderPayload);
  }
}
