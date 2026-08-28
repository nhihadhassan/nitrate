export const LIST_TRANSFER_LIMIT = 25;

export function isCompleteReorder(currentIds: string[], proposedIds: string[]): boolean {
  if (currentIds.length !== proposedIds.length) return false;
  const current = new Set(currentIds);
  const proposed = new Set(proposedIds);
  return proposed.size === current.size && proposedIds.every((id) => current.has(id));
}

export function planListTransfer(selectedIds: string[], existingIds: Iterable<string>) {
  const selected = [...new Set(selectedIds)];
  if (selected.length > LIST_TRANSFER_LIMIT) {
    throw new RangeError(`Transfer up to ${LIST_TRANSFER_LIMIT} films at a time.`);
  }
  const existing = new Set(existingIds);
  const additions = selected.filter((id) => !existing.has(id));
  return { selected, additions, skipped: selected.length - additions.length };
}

export function invitationIsExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
