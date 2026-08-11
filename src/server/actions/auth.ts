'use server';

import { eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { track } from '@/server/analytics';
import { fakeVerify, hashPassword, verifyPassword } from '@/server/auth/password';
import {
  createSession,
  destroyAllSessions,
  destroyCurrentSession,
  requireUser,
} from '@/server/auth/session';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { actionGuard, ValidationError, type ActionResult } from '@/server/errors';
import { consumeRateLimit } from '@/server/rate-limit';

const RESERVED_USERNAMES = new Set([
  'admin',
  'about',
  'api',
  'clubs',
  'club',
  'explore',
  'film',
  'films',
  'help',
  'home',
  'list',
  'lists',
  'login',
  'logout',
  'me',
  'media',
  'nitrate',
  'notifications',
  'person',
  'privacy',
  'review',
  'search',
  'settings',
  'signup',
  'support',
  'terms',
  'guidelines',
  'watchlist',
  'onboarding',
  'moderation',
  'staff',
]);

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'At least 3 characters.')
  .max(20, 'At most 20 characters.')
  .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only.')
  .refine((value) => !RESERVED_USERNAMES.has(value.toLowerCase()), 'That username is reserved.');

const signupSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254),
  username: usernameSchema,
  displayName: z.string().trim().min(1, 'Tell us what to call you.').max(50),
  password: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .max(200, 'That is longer than we can store.'),
  inviteCode: z.string().trim().optional(),
});

function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export async function signupAction(input: unknown): Promise<ActionResult<{ next: string }>> {
  return actionGuard(async () => {
    const parsed = signupSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Please fix the highlighted fields.', fieldErrors(parsed.error));
    }
    const { email, username, displayName, password, inviteCode } = parsed.data;

    await consumeRateLimit('signup', normaliseIp(await headers()));

    const existing = await db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(
        sql`lower(${users.email}) = ${email.toLowerCase()} or lower(${users.username}) = ${username.toLowerCase()}`,
      );

    if (existing.some((row) => row.username.toLowerCase() === username.toLowerCase())) {
      throw new ValidationError('That username is taken.', { username: 'Already taken.' });
    }
    if (existing.some((row) => row.email.toLowerCase() === email.toLowerCase())) {
      throw new ValidationError('An account already uses that email.', {
        email: 'Already registered — try signing in.',
      });
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({ email, username, displayName, passwordHash })
      .returning();

    await createSession(user.id, (await headers()).get('user-agent'));
    await track('signup', user.id, { hasInvite: Boolean(inviteCode) });

    // Invited members land in the club they were invited to right after setup.
    const next = inviteCode ? `/onboarding?invite=${encodeURIComponent(inviteCode)}` : '/onboarding';
    return { next };
  });
}

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username.'),
  password: z.string().min(1, 'Enter your password.'),
});

export async function loginAction(input: unknown): Promise<ActionResult<{ next: string }>> {
  return actionGuard(async () => {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Please fix the highlighted fields.', fieldErrors(parsed.error));
    }
    const { identifier, password } = parsed.data;
    await consumeRateLimit('login', normaliseIp(await headers()));

    const [user] = await db
      .select()
      .from(users)
      .where(
        sql`lower(${users.email}) = ${identifier.toLowerCase()} or lower(${users.username}) = ${identifier.toLowerCase()}`,
      )
      .limit(1);

    if (!user) {
      // Spend the same CPU as a real verify so timing reveals nothing.
      await fakeVerify();
      throw new ValidationError('Those details did not match an account.', {
        password: 'Incorrect email/username or password.',
      });
    }
    if (user.deletedAt) {
      throw new ValidationError('That account has been deleted.', {});
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new ValidationError('Those details did not match an account.', {
        password: 'Incorrect email/username or password.',
      });
    }

    await createSession(user.id, (await headers()).get('user-agent'));
    return { next: user.onboardingCompletedAt ? '/' : '/onboarding' };
  });
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect('/login');
}

export async function signOutEverywhereAction(): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await destroyAllSessions(user.id);
    return null;
  });
}

/**
 * Soft-deletes the account: the row survives so moderation history, club
 * ownership transfers and shared club records do not collapse, but every piece
 * of identifying data is scrubbed and all sessions die.
 */
export async function deleteAccountAction(confirmation: string): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    if (confirmation.trim().toLowerCase() !== user.username.toLowerCase()) {
      throw new ValidationError('Type your username exactly to confirm.', {
        confirmation: 'That does not match your username.',
      });
    }

    const suffix = user.id.slice(0, 8);
    await db
      .update(users)
      .set({
        deletedAt: new Date(),
        email: `deleted+${suffix}@nitrate.invalid`,
        username: `deleted_${suffix}`,
        displayName: 'Deleted account',
        bio: null,
        location: null,
        websiteUrl: null,
        pronouns: null,
        avatarAssetId: null,
        passwordHash: 'deleted',
        profileVisibility: 'private',
      })
      .where(eq(users.id, user.id));

    await destroyAllSessions(user.id);
    return null;
  });
}

function normaliseIp(headerList: Headers): string {
  return (
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerList.get('x-real-ip') ||
    'unknown'
  );
}
