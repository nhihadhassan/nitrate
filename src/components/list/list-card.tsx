import Image from 'next/image';
import Link from 'next/link';

import { posterUrl } from '@/lib/images';
import { pluralize } from '@/lib/utils';

export type ListCardData = {
  id: string;
  title: string;
  description: string | null;
  itemCount: number;
  likeCount: number;
  isRanked: boolean;
  visibility: 'public' | 'followers' | 'private';
  covers: string[];
};

/**
 * Lists are represented by a fanned stack of their first few posters. It reads
 * as "a collection of films" at a glance without needing a cover image upload.
 */
export function ListCard({
  list,
  author,
}: {
  list: ListCardData;
  author?: { username: string; displayName: string };
}) {
  return (
    <Link
      href={`/list/${list.id}`}
      className="interactive-card group block rounded-lg border border-line p-3 hover:border-line-strong"
      data-pointer-light
      data-reveal="card"
    >
      <div className="flex h-24 items-stretch gap-0 overflow-hidden">
        {list.covers.length ? (
          list.covers.slice(0, 5).map((path, index) => (
            <div
              key={`${path}-${index}`}
              className="relative aspect-[2/3] h-full shrink-0 overflow-hidden rounded-xs border border-canvas transition-transform duration-300 group-hover:translate-y-[-2px]"
              style={{ marginLeft: index === 0 ? 0 : '-1.25rem', zIndex: 10 - index }}
            >
              <Image
                src={posterUrl(path, 'sm')!}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
          ))
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-xs border border-dashed border-line text-xs text-dim">
            Empty list
          </div>
        )}
      </div>

      <p className="mt-3 truncate font-medium group-hover:text-ember">{list.title}</p>
      <p className="mt-0.5 text-xs text-dim">
        {author ? `${author.displayName} · ` : ''}
        {pluralize(list.itemCount, 'film')}
        {list.isRanked ? ' · Ranked' : ''}
        {list.visibility !== 'public' ? ` · ${list.visibility === 'private' ? 'Private' : 'Followers'}` : ''}
      </p>
      {list.description ? (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{list.description}</p>
      ) : null}
    </Link>
  );
}
