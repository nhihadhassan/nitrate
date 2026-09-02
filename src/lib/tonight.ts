export const TONIGHT_BATCH_SIZE = 3;
export const TONIGHT_MAX_OFFSET = 99;

export function normalizeTonightOffset(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '0', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  const bounded = Math.min(Math.floor(parsed), TONIGHT_MAX_OFFSET);
  return bounded - (bounded % TONIGHT_BATCH_SIZE);
}

export function paginateTonightPool<T>(pool: T[], requestedOffset: number) {
  const totalEligible = pool.length;
  const normalized = normalizeTonightOffset(requestedOffset);
  const finalOffset = totalEligible > 0
    ? Math.floor((totalEligible - 1) / TONIGHT_BATCH_SIZE) * TONIGHT_BATCH_SIZE
    : 0;
  const offset = Math.min(normalized, finalOffset);
  const items = pool.slice(offset, offset + TONIGHT_BATCH_SIZE);

  return {
    items,
    offset,
    totalEligible,
    hasMore: offset + items.length < totalEligible,
  };
}
