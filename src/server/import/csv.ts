import 'server-only';

/**
 * A small, dependency-free RFC 4180 CSV reader.
 *
 * Letterboxd exports contain quoted review bodies with embedded commas, quotes
 * and newlines, so a naive split on "," corrupts real user data. This handles
 * quoting, escaped quotes and CRLF properly.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  // Strip a UTF-8 BOM; Letterboxd exports frequently include one.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\r') {
      // Handled by the \n branch.
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export type CsvTable = { headers: string[]; rows: Record<string, string>[] };

export function toTable(text: string): CsvTable {
  const raw = parseCsv(text);
  if (!raw.length) return { headers: [], rows: [] };

  const headers = raw[0].map((h) => h.trim());
  const rows = raw.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? '').trim();
    });
    return record;
  });

  return { headers, rows };
}

/** Letterboxd headers vary slightly between export types and versions. */
export function pick(row: Record<string, string>, ...names: string[]): string | null {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== '') return value;
  }
  const lowered = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const name of names) {
    const value = lowered[name.toLowerCase()];
    if (value !== undefined && value !== '') return value;
  }
  return null;
}
