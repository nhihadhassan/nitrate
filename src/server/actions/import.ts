'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { track } from '@/server/analytics';
import { requireUser } from '@/server/auth/session';
import { actionGuard, ValidationError, type ActionResult } from '@/server/errors';
import {
  createImportBatch,
  matchBatch,
  runImport,
  setRowMatch,
  type ImportProgress,
} from '@/server/import/letterboxd';
import { consumeRateLimit } from '@/server/rate-limit';

const uploadSchema = z.object({
  files: z
    .array(
      z.object({
        name: z.string().max(200),
        text: z.string().max(8_000_000),
      }),
    )
    .min(1, 'Choose at least one CSV.')
    .max(12),
});

export async function startImportAction(
  input: z.infer<typeof uploadSchema>,
): Promise<ActionResult<{ batchId: string; staged: number }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await consumeRateLimit('import', user.id);
    const parsed = uploadSchema.parse(input);

    const csvs = parsed.files.filter((file) => file.name.toLowerCase().endsWith('.csv'));
    if (!csvs.length) throw new ValidationError('Those files are not CSVs.');

    const { batch, staged } = await createImportBatch(user.id, csvs);
    await track('import_started', user.id, { batchId: batch.id, rows: staged });
    return { batchId: batch.id, staged };
  });
}

/**
 * Matching runs in slices driven by the client rather than one long request, so
 * a big export cannot exceed a serverless timeout and progress is visible.
 */
export async function matchImportSliceAction(
  batchId: string,
): Promise<ActionResult<{ remaining: number }>> {
  return actionGuard(async () => {
    await requireUser();
    const result = await matchBatch(batchId, 24);
    return result;
  });
}

export async function resolveImportRowAction(
  rowId: string,
  providerId: string | null,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await setRowMatch(user.id, rowId, providerId);
    return null;
  });
}

export async function confirmImportAction(
  batchId: string,
): Promise<ActionResult<ImportProgress>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const progress = await runImport(user.id, batchId);
    if (!progress.done) return progress;
    const summary = progress.summary;
    await track('import_completed', user.id, { batchId, ...summary });
    revalidatePath(`/@${user.username}`);
    revalidatePath('/');
    return progress;
  });
}
