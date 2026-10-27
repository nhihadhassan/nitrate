'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/primitives';
import { CalendarIcon, CheckIcon, PlusIcon, SparkIcon, UsersIcon } from '@/components/ui/icons';
import { StartRoundSheet, type StartRoundTheme } from '@/components/club/round-controls';
import { useToast } from '@/components/ui/toast';
import { backdropUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import type { MovieTheme, RankedTheme, ThemeSuggestionLabel } from '@/lib/movie-themes';
import { startRoundAction } from '@/server/actions/clubs';

function suggestionLabelText(label: ThemeSuggestionLabel, monthName: string): string {
  switch (label) {
    case 'perfect-for-month':
      return `Perfect for ${monthName}`;
    case 'based-on-club':
      return 'Based on your club';
    case 'popular':
      return 'Popular on Nitrate';
    case 'trending':
      return 'Trending';
  }
}

function toStartRoundTheme(theme: MovieTheme): StartRoundTheme {
  return {
    themeId: theme.id,
    themeName: `${theme.emoji} ${theme.name}`,
    themeDescription: theme.description,
    themeType: theme.type,
    themeCriteria: theme.criteria,
  };
}

/**
 * The theme-selection step before a round's nominations open. One
 * responsive component. The mockups only differ in stacking/grid between
 * desktop and mobile, not in interaction, so this follows the codebase's
 * dominant pattern of a single component with Tailwind breakpoints rather
 * than a parallel mobile file.
 */
export function ThemePicker({
  clubId,
  clubSlug,
  suggestions,
  allThemes,
  monthLabel,
  monthName,
  imageByThemeId = {},
}: {
  clubId: string;
  clubSlug: string;
  suggestions: RankedTheme[];
  allThemes: MovieTheme[];
  monthLabel: string;
  monthName: string;
  /** One representative TMDB image path per curated theme, for card thumbnails. */
  imageByThemeId?: Record<string, string | null>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(suggestions[0]?.theme.id ?? null);
  const [showAll, setShowAll] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmoji, setCustomEmoji] = useState('🎬');
  const [customDescription, setCustomDescription] = useState('');
  const [customTheme, setCustomTheme] = useState<MovieTheme | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = suggestions.slice(0, 4);
  const rest = useMemo(
    () => allThemes.filter((theme) => !shown.some((s) => s.theme.id === theme.id)),
    [allThemes, shown],
  );

  const selected: MovieTheme | null =
    customTheme?.id === selectedId
      ? customTheme
      : (shown.find((s) => s.theme.id === selectedId)?.theme ?? rest.find((t) => t.id === selectedId) ?? null);

  function selectCustom() {
    if (!customName.trim()) return;
    const theme: MovieTheme = {
      id: 'custom',
      name: customName.trim(),
      emoji: customEmoji.trim() || '🎬',
      description: customDescription.trim() || 'A theme this club made up.',
      type: 'custom',
      criteria: {},
    };
    setCustomTheme(theme);
    setSelectedId(theme.id);
    setCustomOpen(false);
  }

  function handleContinue() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const nominationsCloseAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const result = await startRoundAction({
        clubId,
        title: null,
        mode: 'wheel',
        nominationLimitPerMember: 1,
        nominationsCloseAt,
        votingCloseAt: null,
        theme: toStartRoundTheme(selected),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast({ message: 'Everyone can start picking', tone: 'success' });
      router.push(`/club/${clubSlug}`);
      router.refresh();
    });
  }

  return (
    <div className="pb-28 lg:pb-16">
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden px-4 py-8 sm:mx-0 sm:rounded-2xl sm:border sm:border-line sm:px-8 sm:py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center lg:gap-8">
        <div className="min-w-0">
          <p className="eyebrow text-ember">{monthLabel} MOVIE NIGHT</p>
          <h1 className="mt-2 max-w-xl font-display text-4xl leading-[1.05] text-text sm:text-5xl">
            What&apos;s the vibe this month?
          </h1>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-xs">
            <div className="flex items-center gap-2 text-dim">
              <SparkIcon className="h-4 w-4 text-iris" />
              <span>
                <dt className="inline font-medium text-text">Curated suggestions</dt>
              </span>
            </div>
            <div className="flex items-center gap-2 text-dim">
              <UsersIcon className="h-4 w-4 text-iris" />
              <span>
                <dt className="inline font-medium text-text">Built for your club</dt>
              </span>
            </div>
            <div className="flex items-center gap-2 text-dim">
              <CalendarIcon className="h-4 w-4 text-iris" />
              <span>
                <dt className="inline font-medium text-text">Ready to watch</dt>
              </span>
            </div>
          </dl>
        </div>
      </section>

      {/* Suggested themes */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-text">Suggested themes</h2>
          {!showAll && rest.length ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-sm text-iris hover:underline"
            >
              See all themes →
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((ranked) => (
            <ThemeCard
              key={ranked.theme.id}
              theme={ranked.theme}
              label={suggestionLabelText(ranked.label, monthName)}
              selected={selectedId === ranked.theme.id}
              onSelect={() => setSelectedId(ranked.theme.id)}
              imageUrl={backdropUrl(imageByThemeId[ranked.theme.id] ?? null, 'sm')}
            />
          ))}
        </div>

        {showAll && rest.length ? (
          <>
            <h3 className="mt-8 font-display text-lg text-text">More ideas for your club</h3>
            <div className="mt-4 flex flex-col gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
              {rest.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  label={null}
                  selected={selectedId === theme.id}
                  onSelect={() => setSelectedId(theme.id)}
                  imageUrl={backdropUrl(imageByThemeId[theme.id] ?? null, 'sm')}
                />
              ))}
            </div>
          </>
        ) : null}

        <div className="mt-5">
          {customTheme ? (
            <ThemeCard
              theme={customTheme}
              label="Your idea"
              selected={selectedId === customTheme.id}
              onSelect={() => setSelectedId(customTheme.id)}
              imageUrl={null}
            />
          ) : null}
          <button
            type="button"
            onClick={() => setCustomOpen((open) => !open)}
            className="mt-3 text-sm text-iris hover:underline"
          >
            + Create custom theme
          </button>
          {customOpen ? (
            <div className="mt-3 max-w-md space-y-3 rounded-lg border border-line p-4">
              <div className="flex gap-3">
                <Field label="Emoji" htmlFor="custom-theme-emoji" className="w-20">
                  <input
                    id="custom-theme-emoji"
                    value={customEmoji}
                    onChange={(event) => setCustomEmoji(event.target.value)}
                    maxLength={4}
                    className={inputClass}
                  />
                </Field>
                <Field label="Theme name" htmlFor="custom-theme-name" className="flex-1">
                  <input
                    id="custom-theme-name"
                    value={customName}
                    onChange={(event) => setCustomName(event.target.value)}
                    maxLength={80}
                    placeholder="Movies that made us cry"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Description" htmlFor="custom-theme-description" optional>
                <input
                  id="custom-theme-description"
                  value={customDescription}
                  onChange={(event) => setCustomDescription(event.target.value)}
                  maxLength={140}
                  placeholder="A short line about the vibe"
                  className={inputClass}
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCustomOpen(false)}>
                  Cancel
                </Button>
                <Button variant="iris" size="sm" disabled={!customName.trim()} onClick={selectCustom}>
                  Use this theme
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur-md [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))] lg:sticky lg:mt-8 lg:rounded-xl lg:border lg:px-6 lg:py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-dim">{monthName} Movie Night</p>
            <p className="truncate text-sm font-medium text-text">
              {selected ? `${selected.emoji} ${selected.name}` : 'Choose a theme to continue'}
            </p>
            {error ? <p className="mt-1 text-xs text-rose">{error}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setCustomizing(true)}
              className="hidden text-sm text-muted hover:text-text sm:inline"
            >
              Customize round settings
            </button>
            <Button variant="iris" disabled={!selected || pending} onClick={handleContinue}>
              {pending ? 'Starting…' : 'Continue to movie suggestions →'}
            </Button>
          </div>
        </div>
      </div>

      {customizing ? (
        <StartRoundSheet
          clubId={clubId}
          clubSlug={clubSlug}
          onClose={() => setCustomizing(false)}
          theme={selected ? toStartRoundTheme(selected) : null}
        />
      ) : null}
    </div>
  );
}

function ThemeCard({
  theme,
  label,
  selected,
  onSelect,
  imageUrl,
}: {
  theme: MovieTheme;
  label: string | null;
  selected: boolean;
  onSelect: () => void;
  imageUrl: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group relative flex items-center gap-3 overflow-hidden rounded-xl border p-3 text-left transition-colors sm:flex-col sm:items-stretch sm:p-0',
        selected
          ? 'border-ember bg-ember/[0.08] shadow-[0_0_0_1px_rgb(234_88_50/0.35)]'
          : 'border-line bg-canvas-raised hover:border-line-strong',
      )}
    >
      {/* Mobile: a square thumbnail beside the text, like a list row.
          Desktop: the same image, widened across the top of a tile. */}
      <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-strong sm:h-28 sm:w-full sm:rounded-none sm:rounded-t-xl">
        {imageUrl ? (
          <Image src={imageUrl} alt="" fill sizes="(max-width: 640px) 64px, 25vw" className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-3xl" aria-hidden>
            {theme.emoji}
          </span>
        )}
        {imageUrl ? (
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent"
          />
        ) : null}
      </span>

      <span className="min-w-0 flex-1 sm:p-4">
        {label ? (
          <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-ember/30 bg-ember/10 px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-ember">
            <span aria-hidden>{theme.emoji}</span>
            {label}
          </span>
        ) : null}
        <span className="mt-1 block font-display text-base leading-tight text-text sm:text-lg">
          {theme.name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted sm:mt-1 sm:whitespace-normal sm:text-sm">
          {theme.description}
        </span>
      </span>

      <span
        aria-hidden
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border sm:absolute sm:right-3 sm:top-3 sm:h-9 sm:w-9 sm:border-2 sm:border-canvas-raised',
          selected ? 'border-ember bg-ember text-inverse' : 'border-line-strong bg-canvas-raised/90 text-muted',
        )}
      >
        {selected ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
      </span>
    </button>
  );
}
