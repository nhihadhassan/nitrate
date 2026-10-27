import { themeCriteriaChips, type ThemeCriteria, type ThemeType } from '@/lib/movie-themes';
import { cn } from '@/lib/utils';

/**
 * The plain shape every surface that can carry a theme already has (a round,
 * a screening, a history entry). One component pair reads it, so the badge
 * and chip row never drift between the dashboard, the wheel, and history.
 */
export type ThemeInfo = {
  themeName: string | null;
  themeId?: string | null;
  themeType?: ThemeType | null;
  themeCriteria?: ThemeCriteria | null;
};

function themeEmoji(theme: ThemeInfo): string {
  // The name already carries the emoji for curated + custom themes ("🎃 Spooky
  // Season"); fall back to a plain film clapper when a round predates that.
  const match = theme.themeName?.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u);
  return match?.[1] ?? '🎬';
}

function themeLabel(theme: ThemeInfo): string {
  return theme.themeName?.replace(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u, '') ?? '';
}

/** Small emoji + name pill. The corner badge on a themed hero, or a history row. */
export function ThemeBadge({ theme, className }: { theme: ThemeInfo; className?: string }) {
  if (!theme.themeName) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember/10 px-2.5 py-1 text-xs font-medium text-ember',
        className,
      )}
    >
      <span aria-hidden>{themeEmoji(theme)}</span>
      <span className="truncate">{themeLabel(theme)}</span>
    </span>
  );
}

/** The "Horror · Thriller · Mystery · Supernatural" chip row under a themed hero. */
export function ThemeChips({ theme, className }: { theme: ThemeInfo; className?: string }) {
  if (!theme.themeCriteria) return null;
  const chips = themeCriteriaChips({ id: theme.themeId ?? '', criteria: theme.themeCriteria });
  if (!chips.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-full border border-line bg-canvas-raised/60 px-3 py-1 text-xs font-medium text-dim"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}
