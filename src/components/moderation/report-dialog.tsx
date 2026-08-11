'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { FormError, inputClass } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import {
  REPORT_CATEGORY_LABELS,
  type ReportCategory,
  type ReportSubjectType,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { reportAction } from '@/server/actions/social';

export function ReportDialog({
  subjectType,
  subjectId,
  subjectLabel,
  onClose,
}: {
  subjectType: ReportSubjectType;
  subjectId: string;
  subjectLabel: string;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Report ${subjectLabel}`}
      description="Our moderators review every report. We keep a copy of the content even if it is deleted."
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={pending || !category}
            onClick={() => {
              if (!category) return;
              setError(null);
              startTransition(async () => {
                const result = await reportAction({
                  subjectType,
                  subjectId,
                  category,
                  details: details.trim() || undefined,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                toast({ message: 'Report submitted. Thank you.', tone: 'success' });
                onClose();
              });
            }}
          >
            {pending ? 'Sending…' : 'Submit report'}
          </Button>
        </div>
      }
    >
      <fieldset className="space-y-1.5">
        <legend className="mb-2 text-sm font-medium">What is the problem?</legend>
        {(Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[]).map((key) => (
          <label
            key={key}
            className={cn(
              'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors',
              category === key ? 'border-ember/40 bg-ember/10' : 'border-line hover:border-line-strong',
            )}
          >
            <input
              type="radio"
              name="report-category"
              value={key}
              checked={category === key}
              onChange={() => setCategory(key)}
              className="h-4 w-4 accent-[var(--ember)]"
            />
            {REPORT_CATEGORY_LABELS[key]}
          </label>
        ))}
      </fieldset>

      <div className="mt-4 space-y-1.5">
        <label htmlFor="report-details" className="text-sm font-medium">
          Anything else? <span className="font-normal text-dim">Optional</span>
        </label>
        <textarea
          id="report-details"
          rows={3}
          maxLength={1000}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          className={cn(inputClass, 'resize-y')}
          placeholder="Context helps us act faster."
        />
      </div>

      <div className="mt-3">
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  );
}
