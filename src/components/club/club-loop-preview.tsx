import { cn } from '@/lib/utils';

const STEPS = [
  ['01', 'Pick', 'Everyone brings one film.'],
  ['02', 'Decide', 'Spin the wheel or vote.'],
  ['03', 'Schedule', 'Put movie night on the calendar.'],
  ['04', 'Watch', 'See who is in.'],
  ['05', 'Rate', 'Score it together.'],
  ['06', 'Remember', 'Keep the night in club history.'],
] as const;

export function ClubLoopPreview({ compact = false }: { compact?: boolean }) {
  return (
    <ol className={cn('grid gap-2 sm:grid-cols-3 lg:grid-cols-6', compact && 'lg:grid-cols-6')} aria-label="How Movie Clubs work">
      {STEPS.map(([number, title, body], index) => (
        <li
          key={title}
          className={cn(
            'relative min-h-28 overflow-hidden rounded-lg border border-line bg-surface/45 p-3.5',
            index === 1 && 'border-iris/35 bg-iris/[0.06]',
            compact && 'min-h-24',
          )}
          data-reveal="card"
        >
          <span className="font-display text-lg text-ember/70 tabular">{number}</span>
          <p className="mt-3 font-medium">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
        </li>
      ))}
    </ol>
  );
}
