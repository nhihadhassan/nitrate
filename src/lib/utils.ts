import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- */
/* Ratings                                                                    */
/* -------------------------------------------------------------------------- */

/** Ratings are stored as half-stars: an integer 1..10 where 10 === ★★★★★. */
export const MIN_RATING = 1;
export const MAX_RATING = 10;

export function isValidRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_RATING && value <= MAX_RATING;
}

/** 7 -> 3.5 */
export function toStars(halfStars: number): number {
  return halfStars / 2;
}

/** 3.5 -> 7 */
export function toHalfStars(stars: number): number {
  return Math.round(stars * 2);
}

export function formatStars(halfStars: number | null | undefined): string {
  if (halfStars == null) return '—';
  const stars = halfStars / 2;
  return Number.isInteger(stars) ? `${stars}.0` : stars.toFixed(1);
}

/**
 * "★★★½" for plain-text contexts only — an email subject, an export, a share
 * string. Never render this in the DOM: a screen reader reads it as a run of
 * "black star" characters. On screen, use `<Stars>`, which pairs the glyphs
 * with a single readable label.
 */
export function starGlyphs(halfStars: number): string {
  const full = Math.floor(halfStars / 2);
  const half = halfStars % 2 === 1;
  return '★'.repeat(full) + (half ? '½' : '');
}

export function ratingLabel(halfStars: number | null | undefined): string {
  if (halfStars == null) return 'Not rated';
  const stars = halfStars / 2;
  return `${stars} out of 5 stars`;
}

export function averageOf(sum: number, count: number): number | null {
  if (!count) return null;
  return sum / count;
}

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

export function slugify(input: string, maxLength = 60): string {
  const base = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return base || 'untitled';
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1).trimEnd()}…`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}

export function formatCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) {
    const k = count / 1000;
    return `${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}k`;
  }
  const m = count / 1_000_000;
  return `${m < 10 ? m.toFixed(1).replace(/\.0$/, '') : Math.round(m)}m`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] ?? '').join('').toUpperCase() || '?';
}

/* -------------------------------------------------------------------------- */
/* Time                                                                       */
/* -------------------------------------------------------------------------- */

export function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
];

export function relativeTime(value: Date | string, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return seconds >= 0 ? 'now' : 'just now';
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' });
  for (const [unit, unitSeconds] of RELATIVE_UNITS) {
    if (abs >= unitSeconds) {
      return formatter.format(Math.round(seconds / unitSeconds), unit);
    }
  }
  return formatter.format(Math.round(seconds / 60), 'minute');
}

/** Formats a `YYYY-MM-DD` string without dragging it through a timezone. */
export function formatDateOnly(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function todayIsoDate(timeZone = 'UTC'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts;
}

/**
 * Every club shares one clock. Movie nights are a Toronto thing, so screening
 * times, poll options and history dates are always shown in Eastern regardless
 * of where the viewer — or the club's stored timezone — happens to be. One
 * displayed time for the whole group beats each member doing the maths.
 */
export const CLUB_TIME_ZONE = 'America/Toronto';

/**
 * "Fri Sept 11, 8:00 PM" — a wall-clock time in {@link CLUB_TIME_ZONE}, with no
 * offset suffix. Built from parts because no single locale gives both the
 * "Sept" abbreviation (en-GB) and an uppercase "PM" (en-US).
 */
export function formatClubDateTime(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: CLUB_TIME_ZONE,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
    return `${get('weekday')} ${get('month')} ${get('day')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`;
  } catch {
    return date.toISOString();
  }
}

/** The UTC offset {@link CLUB_TIME_ZONE} is at on a given instant, in minutes. */
function clubOffsetMinutes(at: Date): number {
  const label =
    new Intl.DateTimeFormat('en-US', { timeZone: CLUB_TIME_ZONE, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const match = label.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * Read a `YYYY-MM-DDTHH:mm` string as a wall-clock time in {@link CLUB_TIME_ZONE}
 * and return the instant it names — so "8:00 PM" means 8 PM in Toronto whoever
 * typed it. Handles the ~1h DST error by resolving the offset twice.
 */
export function clubLocalToInstant(local: string): Date {
  const naive = new Date(`${local}:00Z`);
  if (Number.isNaN(naive.getTime())) return new Date(NaN);
  const firstGuess = new Date(naive.getTime() - clubOffsetMinutes(naive) * 60_000);
  return new Date(naive.getTime() - clubOffsetMinutes(firstGuess) * 60_000);
}

/** `YYYY-MM-DDTHH:mm` for an instant, as wall-clock in {@link CLUB_TIME_ZONE}. */
export function clubLocalInputValue(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLUB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export function yearOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const year = Number(value.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K) {
  return items.reduce<Record<K, T[]>>(
    (acc, item) => {
      const k = key(item);
      (acc[k] ??= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
