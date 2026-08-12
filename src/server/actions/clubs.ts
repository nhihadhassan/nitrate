'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { env } from '@/env';
import { track } from '@/server/analytics';
import { requireUser } from '@/server/auth/session';
import { actionGuard, ValidationError, type ActionResult } from '@/server/errors';
import { ensureMovieByProviderId, getMovieById } from '@/server/movies/catalog';
import { consumeRateLimit } from '@/server/rate-limit';
import {
  addToQueue,
  cancelRound,
  cancelScreening,
  castVote,
  closeVoting,
  completeScreening,
  confirmAttendance,
  createClub,
  createInvite,
  deleteClub,
  deleteDiscussionPost,
  getClubById,
  getScreeningById,
  joinClubByCode,
  nominate,
  openVoting,
  postDiscussion,
  removeFromQueue,
  removeMember,
  requireMembership,
  scheduleScreening,
  setMemberRole,
  setRsvp,
  setWeeklyPick,
  spinWheel,
  startRound,
  submitClubRating,
  transferOwnership,
  updateClub,
  updateScreening,
  withdrawNomination,
} from '@/server/services/clubs';
import { notify, notifyClub } from '@/server/services/notifications';

type FilmRefInput = { movieId?: string; providerId?: string };

async function resolveFilm(ref: FilmRefInput) {
  if (ref.movieId) return getMovieById(ref.movieId);
  if (ref.providerId) return ensureMovieByProviderId(ref.providerId);
  throw new ValidationError('Choose a film first.');
}

/* -------------------------------------------------------------------------- */
/* Club lifecycle                                                             */
/* -------------------------------------------------------------------------- */

const createClubSchema = z.object({
  name: z.string().trim().min(2, 'Give the club a name.').max(60),
  description: z.string().trim().max(600).nullable(),
  visibility: z.enum(['private', 'public']),
  timezone: z.string().trim().min(1).max(64),
  interests: z.array(z.string().trim().max(30)).max(8),
  imageAssetId: z.string().uuid().nullable().optional(),
});

export async function createClubAction(
  input: z.infer<typeof createClubSchema>,
): Promise<ActionResult<{ slug: string; inviteCode: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await consumeRateLimit('club_create', user.id);
    const parsed = createClubSchema.parse(input);

    const club = await createClub({
      ownerId: user.id,
      name: parsed.name,
      description: parsed.description,
      visibility: parsed.visibility,
      timezone: parsed.timezone,
      interests: parsed.interests,
      imageAssetId: parsed.imageAssetId ?? null,
    });

    await track('club_created', user.id, { clubId: club.id, visibility: club.visibility });
    revalidatePath('/clubs');
    return { slug: club.slug, inviteCode: club.inviteCode };
  });
}

export async function updateClubAction(input: {
  clubId: string;
  name?: string;
  description?: string | null;
  visibility?: 'private' | 'public';
  timezone?: string;
  interests?: string[];
  imageAssetId?: string | null;
  blindRatingsEnabled?: boolean;
}): Promise<ActionResult<{ slug: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const { clubId, ...patch } = input;
    const club = await updateClub(clubId, user.id, patch);
    revalidatePath(`/club/${club.slug}`);
    return { slug: club.slug };
  });
}

export async function deleteClubAction(clubId: string): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await deleteClub(clubId, user.id);
    revalidatePath('/clubs');
    return null;
  });
}

export async function joinClubAction(
  code: string,
): Promise<ActionResult<{ slug: string; alreadyMember: boolean }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const { club, alreadyMember } = await joinClubByCode(code, user.id);

    if (!alreadyMember) {
      await track('club_joined', user.id, { clubId: club.id });
      await notifyClub(club.id, {
        actorId: user.id,
        type: 'club_member_joined',
        url: `/club/${club.slug}/members`,
        body: `${user.displayName} joined ${club.name}`,
      });
    }

    revalidatePath('/clubs');
    return { slug: club.slug, alreadyMember };
  });
}

export async function createInviteAction(input: {
  clubId: string;
  invitedUserId?: string | null;
  expiresInDays?: number | null;
}): Promise<ActionResult<{ url: string; code: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await consumeRateLimit('invite', user.id);
    const { code } = await createInvite({
      clubId: input.clubId,
      createdByUserId: user.id,
      invitedUserId: input.invitedUserId ?? null,
      expiresInDays: input.expiresInDays ?? 30,
    });

    if (input.invitedUserId) {
      const club = await getClubById(input.clubId);
      await notify({
        userId: input.invitedUserId,
        actorId: user.id,
        type: 'club_invitation',
        url: `/join/${code}`,
        body: `${user.displayName} invited you to ${club.name}`,
        clubId: club.id,
      });
    }

    return { code, url: `${env.siteUrl}/join/${code}` };
  });
}

export async function leaveClubAction(clubId: string): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await removeMember(clubId, user.id, user.id, 'leave');
    revalidatePath('/clubs');
    return null;
  });
}

export async function moderateMemberAction(input: {
  clubId: string;
  userId: string;
  action: 'promote' | 'demote' | 'remove' | 'ban' | 'transfer';
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const club = await getClubById(input.clubId);

    switch (input.action) {
      case 'promote':
        await setMemberRole(input.clubId, user.id, input.userId, 'admin');
        break;
      case 'demote':
        await setMemberRole(input.clubId, user.id, input.userId, 'member');
        break;
      case 'transfer':
        await transferOwnership(input.clubId, user.id, input.userId);
        break;
      case 'remove':
        await removeMember(input.clubId, user.id, input.userId, 'remove');
        break;
      case 'ban':
        await removeMember(input.clubId, user.id, input.userId, 'ban');
        break;
    }

    revalidatePath(`/club/${club.slug}/members`);
    return null;
  });
}

/* -------------------------------------------------------------------------- */
/* Queue                                                                      */
/* -------------------------------------------------------------------------- */

export async function addQueueItemAction(
  input: { clubId: string; note?: string | null } & FilmRefInput,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const movie = await resolveFilm(input);
    await addToQueue(input.clubId, user.id, movie.id, input.note?.trim() || null);
    await track('club_queue_added', user.id, { clubId: input.clubId, movieId: movie.id });
    const club = await getClubById(input.clubId);
    revalidatePath(`/club/${club.slug}`);
    return null;
  });
}

export async function removeQueueItemAction(
  clubId: string,
  itemId: string,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await removeFromQueue(clubId, user.id, itemId);
    const club = await getClubById(clubId);
    revalidatePath(`/club/${club.slug}`);
    return null;
  });
}

/* -------------------------------------------------------------------------- */
/* Rounds                                                                     */
/* -------------------------------------------------------------------------- */

const startRoundSchema = z.object({
  clubId: z.string().uuid(),
  title: z.string().trim().max(80).nullable(),
  mode: z.enum(['vote', 'wheel']).default('vote'),
  nominationLimitPerMember: z.number().int().min(1).max(5),
  nominationsCloseAt: z.string().datetime().nullable(),
  votingCloseAt: z.string().datetime().nullable(),
});

export async function startRoundAction(
  input: z.infer<typeof startRoundSchema>,
): Promise<ActionResult<{ roundId: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = startRoundSchema.parse(input);
    const round = await startRound({
      clubId: parsed.clubId,
      userId: user.id,
      title: parsed.title,
      mode: parsed.mode,
      nominationLimitPerMember: parsed.nominationLimitPerMember,
      nominationsCloseAt: parsed.nominationsCloseAt ? new Date(parsed.nominationsCloseAt) : null,
      votingCloseAt: parsed.votingCloseAt ? new Date(parsed.votingCloseAt) : null,
    });

    const club = await getClubById(parsed.clubId);
    await track('round_opened', user.id, { clubId: club.id, roundId: round.id, mode: parsed.mode });
    await notifyClub(club.id, {
      actorId: user.id,
      type: 'club_nominations_opened',
      url: `/club/${club.slug}`,
      body:
        parsed.mode === 'wheel'
          ? `Submissions are open in ${club.name} — the wheel decides`
          : `Nominations are open in ${club.name}`,
      dedupeKey: `round_open:${round.id}`,
    });

    revalidatePath(`/club/${club.slug}`);
    return { roundId: round.id };
  });
}

export async function nominateAction(
  input: { roundId: string; clubId: string; pitch?: string | null } & FilmRefInput,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const movie = await resolveFilm(input);
    await nominate({
      roundId: input.roundId,
      userId: user.id,
      movieId: movie.id,
      pitch: input.pitch?.trim() || null,
    });
    await track('nomination_created', user.id, { clubId: input.clubId, movieId: movie.id });
    const club = await getClubById(input.clubId);
    revalidatePath(`/club/${club.slug}`);
    return null;
  });
}

export async function withdrawNominationAction(
  nominationId: string,
  clubSlug: string,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await withdrawNomination(nominationId, user.id);
    revalidatePath(`/club/${clubSlug}`);
    return null;
  });
}

export async function openVotingAction(
  roundId: string,
  clubId: string,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await openVoting(roundId, user.id);
    const club = await getClubById(clubId);
    await notifyClub(club.id, {
      actorId: user.id,
      type: 'club_voting_opened',
      url: `/club/${club.slug}`,
      body: `Voting is open in ${club.name}`,
      dedupeKey: `voting_open:${roundId}`,
    });
    revalidatePath(`/club/${club.slug}`);
    return null;
  });
}

export async function castVoteAction(input: {
  roundId: string;
  nominationId: string;
  clubId: string;
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await castVote(input.roundId, user.id, input.nominationId);
    await track('vote_cast', user.id, { clubId: input.clubId, roundId: input.roundId });
    const club = await getClubById(input.clubId);
    revalidatePath(`/club/${club.slug}`);
    return null;
  });
}

export async function closeVotingAction(
  roundId: string,
  clubId: string,
): Promise<ActionResult<{ movieTitle: string; movieSlug: string; voteCount: number; tied: boolean }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const result = await closeVoting(roundId, user.id);
    const club = await getClubById(clubId);

    await track('winner_revealed', user.id, {
      clubId,
      roundId,
      movieId: result.winner?.movie.id,
    });
    await notifyClub(club.id, {
      actorId: user.id,
      type: 'club_winner_selected',
      url: `/club/${club.slug}`,
      body: `${club.name} is watching ${result.winner?.movie.title}`,
      dedupeKey: `winner:${roundId}`,
    });

    revalidatePath(`/club/${club.slug}`);
    return {
      movieTitle: result.winner?.movie.title ?? '',
      movieSlug: result.winner?.movie.slug ?? '',
      voteCount: result.winner?.voteCount ?? 0,
      tied: result.tied,
    };
  });
}

export type SpinWheelResponse = {
  winnerIndex: number;
  seed: string;
  alreadySpun: boolean;
  movieTitle: string;
  movieSlug: string;
  nominatedBy: string;
  contenderCount: number;
  order: { nominationId: string; movieTitle: string }[];
};

/**
 * The client asks the server to spin; the server decides and commits, then the
 * client animates to a result it had no hand in choosing.
 */
export async function spinWheelAction(
  roundId: string,
  clubId: string,
): Promise<ActionResult<SpinWheelResponse>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const result = await spinWheel(roundId, user.id);
    const club = await getClubById(clubId);

    if (!result.alreadySpun) {
      await track('winner_revealed', user.id, {
        clubId,
        roundId,
        mode: 'wheel',
        movieId: result.winner?.movie.id,
      });
      await notifyClub(club.id, {
        actorId: user.id,
        type: 'club_winner_selected',
        url: `/club/${club.slug}`,
        body: `The wheel picked ${result.winner?.movie.title} for ${club.name}`,
        dedupeKey: `winner:${roundId}`,
      });
    }

    revalidatePath(`/club/${club.slug}`);
    return {
      winnerIndex: result.winnerIndex,
      seed: result.seed,
      alreadySpun: result.alreadySpun,
      movieTitle: result.winner?.movie.title ?? '',
      movieSlug: result.winner?.movie.slug ?? '',
      nominatedBy: result.winner?.nominatedBy ?? '',
      contenderCount: result.order.length,
      order: result.order,
    };
  });
}

export async function setWeeklyPickAction(input: {
  clubId: string;
  enabled: boolean;
  day: number;
  hour: number;
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await setWeeklyPick(input.clubId, user.id, {
      enabled: input.enabled,
      day: input.day,
      hour: input.hour,
    });
    const club = await getClubById(input.clubId);
    revalidatePath(`/club/${club.slug}/settings`);
    return null;
  });
}

export async function cancelRoundAction(
  roundId: string,
  clubSlug: string,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await cancelRound(roundId, user.id);
    revalidatePath(`/club/${clubSlug}`);
    return null;
  });
}

/* -------------------------------------------------------------------------- */
/* Screenings                                                                 */
/* -------------------------------------------------------------------------- */

const scheduleSchema = z.object({
  clubId: z.string().uuid(),
  roundId: z.string().uuid().nullable(),
  movieId: z.string().uuid().optional(),
  providerId: z.string().optional(),
  scheduledAt: z.string().datetime(),
  timezone: z.string().min(1).max(64),
  location: z.string().trim().max(200).nullable(),
  watchLink: z.string().trim().url('Enter a valid link.').max(500).nullable().or(z.literal('')),
  notes: z.string().trim().max(1000).nullable(),
});

export async function scheduleScreeningAction(
  input: z.infer<typeof scheduleSchema>,
): Promise<ActionResult<{ screeningId: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = scheduleSchema.parse(input);
    const movie = await resolveFilm(parsed);

    const screening = await scheduleScreening({
      clubId: parsed.clubId,
      userId: user.id,
      movieId: movie.id,
      roundId: parsed.roundId,
      scheduledAt: new Date(parsed.scheduledAt),
      timezone: parsed.timezone,
      location: parsed.location,
      watchLink: parsed.watchLink || null,
      notes: parsed.notes,
    });

    const club = await getClubById(parsed.clubId);
    await track('screening_scheduled', user.id, { clubId: club.id, screeningId: screening.id });
    await notifyClub(club.id, {
      actorId: user.id,
      type: 'club_screening_scheduled',
      url: `/club/${club.slug}/screening/${screening.id}`,
      body: `${club.name} is watching ${movie.title}`,
      dedupeKey: `screening:${screening.id}`,
    });

    revalidatePath(`/club/${club.slug}`);
    return { screeningId: screening.id };
  });
}

export async function updateScreeningAction(input: {
  screeningId: string;
  clubSlug: string;
  scheduledAt?: string;
  location?: string | null;
  watchLink?: string | null;
  notes?: string | null;
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await updateScreening(input.screeningId, user.id, {
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      location: input.location,
      watchLink: input.watchLink,
      notes: input.notes,
    });
    revalidatePath(`/club/${input.clubSlug}/screening/${input.screeningId}`);
    return null;
  });
}

export async function cancelScreeningAction(
  screeningId: string,
  clubSlug: string,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await cancelScreening(screeningId, user.id);
    revalidatePath(`/club/${clubSlug}`);
    return null;
  });
}

export async function completeScreeningAction(
  screeningId: string,
  clubSlug: string,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const screening = await completeScreening(screeningId, user.id);
    const club = await getClubById(screening.clubId);

    await track('screening_completed', user.id, { clubId: club.id, screeningId });
    await notifyClub(club.id, {
      actorId: user.id,
      type: 'club_screening_completed',
      url: `/club/${club.slug}/screening/${screeningId}`,
      body: `Rate and discuss — ${club.name} finished watching`,
      dedupeKey: `completed:${screeningId}`,
    });

    revalidatePath(`/club/${clubSlug}/screening/${screeningId}`);
    return null;
  });
}

export async function setRsvpAction(input: {
  screeningId: string;
  clubSlug: string;
  rsvp: 'going' | 'maybe' | 'cant';
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await setRsvp(input.screeningId, user.id, input.rsvp);
    await track('screening_rsvp', user.id, { screeningId: input.screeningId, rsvp: input.rsvp });
    revalidatePath(`/club/${input.clubSlug}/screening/${input.screeningId}`);
    return null;
  });
}

export async function confirmAttendanceAction(input: {
  screeningId: string;
  clubSlug: string;
  attended: boolean;
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await confirmAttendance(input.screeningId, user.id, input.attended);
    await track('attendance_confirmed', user.id, {
      screeningId: input.screeningId,
      attended: input.attended,
    });
    revalidatePath(`/club/${input.clubSlug}/screening/${input.screeningId}`);
    return null;
  });
}

export async function submitClubRatingAction(input: {
  screeningId: string;
  clubSlug: string;
  rating: number;
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await submitClubRating(input.screeningId, user.id, input.rating);
    await track('club_rating_submitted', user.id, {
      screeningId: input.screeningId,
      rating: input.rating,
    });
    revalidatePath(`/club/${input.clubSlug}/screening/${input.screeningId}`);
    return null;
  });
}

/* -------------------------------------------------------------------------- */
/* Discussion                                                                 */
/* -------------------------------------------------------------------------- */

export async function postDiscussionAction(input: {
  clubId: string;
  clubSlug: string;
  screeningId: string;
  parentId?: string | null;
  body: string;
  containsSpoilers?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await consumeRateLimit('club_post', user.id);
    await requireMembership(input.clubId, user.id);

    const post = await postDiscussion({
      clubId: input.clubId,
      screeningId: input.screeningId,
      parentId: input.parentId ?? null,
      userId: user.id,
      body: input.body,
      containsSpoilers: input.containsSpoilers ?? false,
    });

    await track('club_discussion_posted', user.id, {
      clubId: input.clubId,
      screeningId: input.screeningId,
      isReply: Boolean(input.parentId),
    });

    if (input.parentId) {
      const screening = await getScreeningById(input.screeningId);
      await notifyClub(input.clubId, {
        actorId: user.id,
        type: 'club_discussion_reply',
        url: `/club/${input.clubSlug}/screening/${screening.id}`,
        body: `${user.displayName} replied in the discussion`,
        dedupeKey: `discussion:${post.id}`,
      });
    }

    revalidatePath(`/club/${input.clubSlug}/screening/${input.screeningId}`);
    return post;
  });
}

export async function deleteDiscussionPostAction(
  postId: string,
  clubSlug: string,
  screeningId: string,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await deleteDiscussionPost(postId, user.id);
    revalidatePath(`/club/${clubSlug}/screening/${screeningId}`);
    return null;
  });
}
