import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { FavoritesEditor } from '@/components/settings/favorites-editor';
import { getCurrentUser } from '@/server/auth/session';
import { getFavoriteFilms } from '@/server/services/profile';

export const metadata: Metadata = { title: 'Favourite films' };
export const dynamic = 'force-dynamic';

export default async function FavoritesSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/settings/favorites');
  const favorites = await getFavoriteFilms(user.id);

  return (
    <FavoritesEditor
      initial={favorites.map((movie) => ({
        movieId: movie.id,
        slug: movie.slug,
        title: movie.title,
        year: movie.year,
        posterPath: movie.posterPath,
      }))}
    />
  );
}
