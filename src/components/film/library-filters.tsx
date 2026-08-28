import { inputClass } from '@/components/ui/primitives';

export type LibraryFilterValues = {
  yearFrom?: string; yearTo?: string; ratingMin?: string; genre?: string; tag?: string;
  director?: string; rewatch?: string; liked?: string; club?: string; context?: string;
  runtimeMax?: string; owned?: string; available?: string;
};

export function LibraryFilters({ action, values, diary = false }: { action: string; values: LibraryFilterValues; diary?: boolean }) {
  const active = Object.values(values).some(Boolean);
  return (
    <details className="mb-5 rounded-lg border border-line bg-surface/45 p-3" open={active}>
      <summary className="cursor-pointer text-sm font-medium">Filters{active ? ' · active' : ''}</summary>
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-muted">Film year from<input name="yearFrom" type="number" min="1880" max="2100" defaultValue={values.yearFrom} className={`${inputClass} mt-1`} /></label>
        <label className="text-xs text-muted">Film year to<input name="yearTo" type="number" min="1880" max="2100" defaultValue={values.yearTo} className={`${inputClass} mt-1`} /></label>
        <label className="text-xs text-muted">Minimum rating<select name="ratingMin" defaultValue={values.ratingMin ?? ''} className={`${inputClass} mt-1`}><option value="">Any</option><option value="6">3 stars</option><option value="7">3½ stars</option><option value="8">4 stars</option><option value="9">4½ stars</option><option value="10">5 stars</option></select></label>
        <label className="text-xs text-muted">Maximum runtime<input name="runtimeMax" type="number" min="1" max="999" placeholder="Minutes" defaultValue={values.runtimeMax} className={`${inputClass} mt-1`} /></label>
        <label className="text-xs text-muted">Director<input name="director" defaultValue={values.director} className={`${inputClass} mt-1`} /></label>
        <label className="text-xs text-muted">Tag<input name="tag" defaultValue={values.tag} className={`${inputClass} mt-1`} /></label>
        <label className="text-xs text-muted">Genre code<input name="genre" defaultValue={values.genre} placeholder="e.g. 18" className={`${inputClass} mt-1`} /></label>
        <label className="text-xs text-muted">Viewing context<select name="context" defaultValue={values.context ?? ''} className={`${inputClass} mt-1`}><option value="">Any</option><option value="cinema">Cinema</option><option value="home">At home</option><option value="friend_home">Friend’s home</option><option value="club">Movie Club</option><option value="festival">Festival</option><option value="travel">Travel</option><option value="other">Other</option></select></label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="liked" value="1" defaultChecked={values.liked === '1'} /> Liked</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="rewatch" value="1" defaultChecked={values.rewatch === '1'} /> Rewatched</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="owned" value="1" defaultChecked={values.owned === '1'} /> In my owned library</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="available" value="1" defaultChecked={values.available === '1'} /> Available in my region</label>
        {diary ? <input type="hidden" name="view" value="diary" /> : null}
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
          <button className="min-h-11 rounded-md bg-ember px-4 text-sm font-semibold text-canvas">Apply filters</button>
          {active ? <a href={action} className="flex min-h-11 items-center px-3 text-sm text-muted underline underline-offset-2">Clear</a> : null}
        </div>
      </form>
      <p className="mt-2 text-xs text-dim">Availability is resolved only when selected. Unknown provider data is fetched or left unknown, never treated as unavailable.</p>
    </details>
  );
}
