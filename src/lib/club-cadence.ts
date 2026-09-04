import type { ClubCadence } from '@/lib/types';

export const CLUB_CADENCE_OPTIONS: Array<{ value: ClubCadence; label: string; detail: string }> = [
  { value: 'weekly', label: 'Weekly', detail: 'One selection each week' },
  { value: 'biweekly', label: 'Every 2 weeks', detail: 'One selection every 14 days' },
  { value: 'monthly', label: 'Monthly', detail: 'One selection each month' },
  { value: 'custom', label: 'Custom', detail: 'Choose the number of days between selections' },
];

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function safeTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format();
    return timeZone;
  } catch {
    return 'UTC';
  }
}

function monthName(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: safeTimeZone(timeZone), month: 'long' }).format(date);
}

function fullDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone(timeZone),
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function cadenceLabel(cadence: ClubCadence, customCadenceDays?: number | null): string {
  if (cadence === 'biweekly') return 'Every 2 weeks';
  if (cadence === 'monthly') return 'Monthly';
  if (cadence === 'custom') return customCadenceDays ? `Every ${customCadenceDays} days` : 'Custom';
  return 'Weekly';
}

export function inlineSelectionLabel(label: string): string {
  return label.startsWith('This ') ? `this ${label.slice(5)}` : label;
}

export function roundMovieLabel(cadence: ClubCadence, roundStart: Date, timeZone: string): string {
  if (cadence === 'monthly') return `${monthName(roundStart, timeZone)}’s movie`;
  if (cadence === 'weekly') return 'This week’s movie';
  return 'This selection’s movie';
}

export function roundSelectionLabel(cadence: ClubCadence, roundStart: Date, timeZone: string): string {
  if (cadence === 'monthly') return `${monthName(roundStart, timeZone)} movie`;
  if (cadence === 'weekly') return 'This week’s movie';
  return 'Current movie selection';
}

export function roundPeriodLabel(cadence: ClubCadence, roundStart: Date, timeZone: string): string {
  const zone = safeTimeZone(timeZone);
  if (cadence === 'monthly') {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'long', year: 'numeric' }).format(roundStart);
  }
  if (cadence === 'weekly') return `Week of ${fullDate(roundStart, zone)}`;
  if (cadence === 'biweekly') {
    const end = new Date(roundStart.getTime() + 13 * 24 * 60 * 60 * 1000);
    return `${fullDate(roundStart, zone)} – ${fullDate(end, zone)}`;
  }
  return fullDate(roundStart, zone);
}

export function nextSelectionAt(
  cadence: ClubCadence,
  roundStart: Date,
  customCadenceDays?: number | null,
): Date {
  if (cadence === 'monthly') {
    const next = new Date(roundStart);
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
    return next;
  }
  const days = cadence === 'weekly' ? 7 : cadence === 'biweekly' ? 14 : Math.max(1, customCadenceDays ?? 30);
  return new Date(roundStart.getTime() + days * 24 * 60 * 60 * 1000);
}

export function nextSelectionCopy(next: Date, now = new Date()): string {
  const days = Math.ceil((next.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Ready for the next movie';
  if (days === 1) return 'Next movie selection tomorrow';
  return `Next movie selection in ${days} days`;
}

export function localDateParts(date: Date, timeZone: string) {
  return dateParts(date, safeTimeZone(timeZone));
}
