/**
 * A minimal, standards-based RFC 5545 (.ics) event serialiser — one VEVENT,
 * no external dependency. Deliberately a plain downloadable file rather than
 * a subscribable feed: a movie night's time changes rarely enough that
 * "download again if it moves" is honest and simple, and it needs no
 * long-lived, guessable URL.
 */

export type CalendarEvent = {
  uid: string;
  title: string;
  /** UTC instant the event starts. */
  start: Date;
  /** UTC instant the event ends. */
  end: Date;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  /** When the event data was generated — also doubles as DTSTAMP. */
  generatedAt?: Date;
};

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/** `YYYYMMDDTHHMMSSZ` — the UTC form, which needs no VTIMEZONE block. */
function formatUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newline are escaped. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');
}

/** RFC 5545 §3.1: lines over 75 octets are folded with CRLF + a leading space. */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let offset = 0;
  let limit = 75;
  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length);
    // Never split a multi-byte UTF-8 character across a fold boundary.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    chunks.push(bytes.subarray(offset, end).toString('utf8'));
    offset = end;
    limit = 74; // continuation lines lose one column to the leading space
  }
  return chunks.join('\r\n ');
}

export function serialiseCalendarEvent(event: CalendarEvent): string {
  const now = event.generatedAt ?? new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nitrate//Movie Night//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${formatUtc(now)}`,
    `DTSTART:${formatUtc(event.start)}`,
    `DTEND:${formatUtc(event.end)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${escapeText(event.url)}`);
  lines.push('STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}
