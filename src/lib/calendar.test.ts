import { describe, expect, it } from 'vitest';

import { serialiseCalendarEvent } from './calendar';

describe('serialiseCalendarEvent', () => {
  it('produces a well-formed single-event calendar', () => {
    const ics = serialiseCalendarEvent({
      uid: 'screening-abc@nitrate.test',
      title: 'Parasite — QA Test Club',
      start: new Date('2026-09-12T20:00:00Z'),
      end: new Date('2026-09-12T22:13:00Z'),
      description: 'Watch link: https://example.com/watch\nOpen in Nitrate: https://example.com/club/qa/screening/1',
      location: 'Nina’s place',
      url: 'https://example.com/club/qa/screening/1',
      generatedAt: new Date('2026-08-27T00:00:00Z'),
    });

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:screening-abc@nitrate.test\r\n');
    expect(ics).toContain('DTSTART:20260912T200000Z\r\n');
    expect(ics).toContain('DTEND:20260912T221300Z\r\n');
    expect(ics).toContain('SUMMARY:Parasite — QA Test Club\r\n');
    expect(ics).toContain('LOCATION:Nina’s place\r\n');
    expect(ics).toContain('STATUS:CONFIRMED\r\n');
  });

  it('escapes commas, semicolons, backslashes and newlines in text fields', () => {
    const ics = serialiseCalendarEvent({
      uid: 'x',
      title: 'A, B; C\\D',
      start: new Date('2026-01-01T00:00:00Z'),
      end: new Date('2026-01-01T02:00:00Z'),
      description: 'Line one\nLine two',
    });
    expect(ics).toContain('SUMMARY:A\\, B\\; C\\\\D\r\n');
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two\r\n');
  });

  it('folds lines longer than 75 octets with a CRLF and a leading space', () => {
    const longTitle = 'A'.repeat(120);
    const ics = serialiseCalendarEvent({
      uid: 'y',
      title: longTitle,
      start: new Date('2026-01-01T00:00:00Z'),
      end: new Date('2026-01-01T02:00:00Z'),
    });
    const summaryLine = ics.split('\r\n').find((line) => line.startsWith('SUMMARY:'));
    expect(summaryLine!.length).toBeLessThanOrEqual(75);
    // The folded continuation begins with a single space, per RFC 5545.
    const summaryIndex = ics.indexOf('SUMMARY:');
    const nextCrlf = ics.indexOf('\r\n', summaryIndex);
    expect(ics[nextCrlf + 2]).toBe(' ');
  });

  it('omits optional fields entirely when absent', () => {
    const ics = serialiseCalendarEvent({
      uid: 'z',
      title: 'No extras',
      start: new Date('2026-01-01T00:00:00Z'),
      end: new Date('2026-01-01T02:00:00Z'),
    });
    expect(ics).not.toContain('DESCRIPTION:');
    expect(ics).not.toContain('LOCATION:');
    expect(ics).not.toContain('URL:');
  });
});
