'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Badge, inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDateOnly } from '@/lib/utils';
import { setUserRoleAction, toggleSuspensionAction } from '@/server/actions/admin';

type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: 'member' | 'moderator' | 'admin';
  suspended: boolean;
  deleted: boolean;
  filmCount: number;
  reportCount: number;
  createdAt: string;
};

export function AdminUserTable({
  users,
  query,
  canSetRoles,
}: {
  users: AdminUser[];
  query: string;
  canSetRoles: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [term, setTerm] = useState(query);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <form
        className="mb-5 flex max-w-md gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(`/admin/users?q=${encodeURIComponent(term)}`);
        }}
      >
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search by username, name or email"
          aria-label="Search users"
          className={inputClass}
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-dim">
              <th className="py-2 font-medium">User</th>
              <th className="py-2 font-medium">Joined</th>
              <th className="py-2 text-right font-medium">Films</th>
              <th className="py-2 text-right font-medium">Reports</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-line align-middle">
                <td className="py-2.5">
                  <Link href={`/@${user.username}`} className="font-medium hover:text-ember">
                    {user.displayName}
                  </Link>
                  <span className="block text-xs text-dim">
                    @{user.username} · {user.email}
                  </span>
                </td>
                <td className="py-2.5 text-xs text-dim tabular">
                  {formatDateOnly(user.createdAt.slice(0, 10))}
                </td>
                <td className="py-2.5 text-right tabular">{user.filmCount}</td>
                <td className="py-2.5 text-right tabular">
                  {user.reportCount > 0 ? (
                    <span className="text-rose">{user.reportCount}</span>
                  ) : (
                    user.reportCount
                  )}
                </td>
                <td className="py-2.5">
                  <span className="flex flex-wrap gap-1">
                    {user.role !== 'member' ? <Badge tone="iris">{user.role}</Badge> : null}
                    {user.suspended ? <Badge tone="rose">suspended</Badge> : null}
                    {user.deleted ? <Badge>deleted</Badge> : null}
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <span className="flex flex-wrap justify-end gap-1.5">
                    <Button
                      variant={user.suspended ? 'outline' : 'danger'}
                      size="sm"
                      disabled={pending || user.deleted}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await toggleSuspensionAction(
                            user.id,
                            user.suspended ? null : 'Community guidelines',
                          );
                          if (!result.ok) {
                            toast({ message: result.error, tone: 'error' });
                            return;
                          }
                          router.refresh();
                        })
                      }
                    >
                      {user.suspended ? 'Unsuspend' : 'Suspend'}
                    </Button>
                    {canSetRoles ? (
                      <select
                        value={user.role}
                        disabled={pending}
                        onChange={(event) =>
                          startTransition(async () => {
                            const result = await setUserRoleAction(
                              user.id,
                              event.target.value as AdminUser['role'],
                            );
                            if (!result.ok) {
                              toast({ message: result.error, tone: 'error' });
                              return;
                            }
                            router.refresh();
                          })
                        }
                        aria-label={`Role for ${user.username}`}
                        className="rounded-md border border-line bg-canvas-raised px-2 py-1 text-xs"
                      >
                        <option value="member">member</option>
                        <option value="moderator">moderator</option>
                        <option value="admin">admin</option>
                      </select>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!users.length ? <p className="py-8 text-center text-sm text-dim">No users matched.</p> : null}
    </div>
  );
}
