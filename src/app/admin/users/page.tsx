import { AdminUserTable } from '@/components/admin/user-table';
import { requireAdmin } from '@/server/auth/session';
import { adminSearchUsers } from '@/server/actions/admin';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const moderator = await requireAdmin();
  const { q } = await searchParams;
  const users = await adminSearchUsers(q ?? '');

  return (
    <AdminUserTable
      canSetRoles={moderator.role === 'admin'}
      query={q ?? ''}
      users={users.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        suspended: Boolean(user.suspendedAt),
        deleted: Boolean(user.deletedAt),
        filmCount: user.filmCount,
        reportCount: user.reportCount,
        createdAt: user.createdAt.toISOString(),
      }))}
    />
  );
}
