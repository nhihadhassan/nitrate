const IMPERSONATION_NAMES = new Set([
  'admin',
  'administrator',
  'moderator',
  'staff',
  'support',
  'security',
  'nitrate',
  'nitrateadmin',
  'nitrate_admin',
  'nitratesupport',
  'officialnitrate',
  'official_nitrate',
]);

export function safeUsername(value: string): boolean {
  const normalized = value.toLowerCase().replaceAll('_', '');
  if (IMPERSONATION_NAMES.has(value.toLowerCase()) || IMPERSONATION_NAMES.has(normalized)) {
    return false;
  }
  return !/(.)\1{5,}/i.test(value);
}

/** Escapes SQL LIKE metacharacters so a public query cannot turn into enumeration. */
export function escapeLikeTerm(value: string): string {
  return value.slice(0, 80).replace(/[\\%_]/g, (match) => `\\${match}`);
}
