import Image from 'next/image';
import Link from 'next/link';

import { avatarUrl, hueFromString } from '@/lib/images';
import { cn, initialsOf } from '@/lib/utils';

export type AvatarUser = {
  username: string;
  displayName: string;
  avatarAssetId: string | null;
};

const SIZES = {
  xs: 'h-5 w-5 text-[0.5rem]',
  sm: 'h-7 w-7 text-[0.625rem]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-14 w-14 text-base',
  xl: 'h-24 w-24 text-2xl',
} as const;

const PIXELS = { xs: 20, sm: 28, md: 36, lg: 56, xl: 96 } as const;

export function Avatar({
  user,
  size = 'md',
  className,
}: {
  user: AvatarUser;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const src = avatarUrl(user.avatarAssetId);
  const hue = hueFromString(user.username);

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line font-semibold uppercase',
        SIZES[size],
        className,
      )}
      style={
        src
          ? undefined
          : {
              // Deterministic, muted duotone so avatarless users still read as people.
              background: `linear-gradient(150deg, hsl(${hue} 42% 26%), hsl(${(hue + 40) % 360} 38% 16%))`,
              color: `hsl(${hue} 60% 84%)`,
            }
      }
    >
      {src ? (
        <Image src={src} alt="" width={PIXELS[size]} height={PIXELS[size]} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initialsOf(user.displayName || user.username)}</span>
      )}
    </span>
  );
}

export function UserChip({
  user,
  size = 'sm',
  className,
  subtitle,
  showUsername,
}: {
  user: AvatarUser;
  size?: keyof typeof SIZES;
  className?: string;
  subtitle?: React.ReactNode;
  showUsername?: boolean;
}) {
  return (
    <Link
      href={`/@${user.username}`}
      className={cn('group flex min-w-0 items-center gap-2', className)}
    >
      <Avatar user={user} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium group-hover:text-ember">
          {user.displayName}
        </span>
        {showUsername ? (
          <span className="block truncate text-xs text-dim">@{user.username}</span>
        ) : null}
        {subtitle ? <span className="block truncate text-xs text-dim">{subtitle}</span> : null}
      </span>
    </Link>
  );
}

export function AvatarStack({
  users,
  max = 5,
  size = 'sm',
}: {
  users: AvatarUser[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <span className="flex items-center">
      <span className="flex -space-x-2">
        {shown.map((user) => (
          <Avatar key={user.username} user={user} size={size} className="ring-2 ring-canvas" />
        ))}
      </span>
      {rest > 0 ? <span className="ml-2 text-xs text-dim tabular">+{rest}</span> : null}
    </span>
  );
}
