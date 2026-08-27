/**
 * Nitrate — database schema.
 *
 * Everything lives in a dedicated `nitrate` Postgres schema so the app can share
 * a cluster without colliding with anything else, and so the runtime role can be
 * granted access to exactly this namespace and nothing more.
 *
 * Conventions
 *  - Ratings are stored as smallint half-stars, 1..10 (i.e. 7 === 3.5 stars).
 *    Never store floats; half-star arithmetic in floats is a bug factory.
 *  - Content that moderation or club history must be able to revisit is
 *    soft-deleted (`deletedAt`) rather than removed.
 *  - Denormalised counters exist only where a feed or grid would otherwise need
 *    an aggregate per row. They are always maintained inside the same
 *    transaction as the mutation that changes them.
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const nitrate = pgSchema('nitrate');

const bytea = customType<{ data: Buffer; notNull: true; default: false }>({
  dataType: () => 'bytea',
});

const now = () => timestamp('', { withTimezone: true });
void now;

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const userRole = nitrate.enum('user_role', ['member', 'moderator', 'admin']);
export const visibility = nitrate.enum('visibility', ['public', 'followers', 'private']);
export const clubVisibility = nitrate.enum('club_visibility', ['private', 'public']);
export const clubRole = nitrate.enum('club_role', ['owner', 'admin', 'member']);
export const clubMemberStatus = nitrate.enum('club_member_status', ['active', 'left', 'banned']);
export const roundStatus = nitrate.enum('round_status', [
  'draft',
  'nominations_open',
  'voting_open',
  'winner_selected',
  'screening_scheduled',
  'completed',
  'cancelled',
]);
export const screeningStatus = nitrate.enum('screening_status', [
  'scheduled',
  'completed',
  'cancelled',
]);
export const rsvpStatus = nitrate.enum('rsvp_status', ['going', 'maybe', 'cant']);
/** A movie-night availability poll: several proposed times, before one is confirmed into a screening. */
export const pollStatus = nitrate.enum('poll_status', ['open', 'closed', 'cancelled']);
export const pollAvailability = nitrate.enum('poll_availability', ['yes', 'maybe', 'no']);
/** How a round decides its winner: members vote, or the wheel picks at random. */
export const selectionMode = nitrate.enum('selection_mode', ['vote', 'wheel']);
export const emailStatus = nitrate.enum('email_status', ['queued', 'sent', 'failed', 'skipped']);
export const creditKind = nitrate.enum('credit_kind', ['cast', 'crew']);
export const entrySource = nitrate.enum('entry_source', ['manual', 'import', 'club']);
export const activityType = nitrate.enum('activity_type', [
  'film_logged',
  'film_watched',
  'film_rated',
  'film_liked',
  'review_created',
  'list_created',
  'list_updated',
  'user_followed',
  'club_created',
  'club_member_joined',
  'club_movie_picked',
  'club_movie_selected',
  'club_screening_scheduled',
  'club_screening_rsvp',
  'club_screening_completed',
  'club_rating_submitted',
  'club_ratings_revealed',
]);
export const notificationType = nitrate.enum('notification_type', [
  'new_follower',
  'review_liked',
  'list_liked',
  'review_comment',
  'list_comment',
  'comment_reply',
  'club_invitation',
  'club_member_joined',
  'club_nominations_opened',
  'club_voting_opened',
  'club_voting_ending',
  'club_winner_selected',
  'club_screening_scheduled',
  'club_screening_reminder',
  'list_collaboration_invite',
  'club_screening_completed',
  'club_discussion_reply',
  'moderation_action',
  'mention',
  'club_join_request',
  'club_join_approved',
  'club_join_declined',
]);
export const subjectType = nitrate.enum('subject_type', [
  'user',
  'review',
  'comment',
  'list',
  'club',
  'club_post',
]);
export const reportStatus = nitrate.enum('report_status', [
  'open',
  'reviewing',
  'actioned',
  'dismissed',
]);
export const reportCategory = nitrate.enum('report_category', [
  'spam',
  'harassment',
  'hate_speech',
  'sexual_content',
  'violence',
  'self_harm',
  'spoilers',
  'misinformation',
  'impersonation',
  'other',
]);
export const importStatus = nitrate.enum('import_status', [
  'uploaded',
  'matching',
  'preview',
  'importing',
  'completed',
  'failed',
  'cancelled',
]);
export const importRowKind = nitrate.enum('import_row_kind', [
  'watched',
  'diary',
  'rating',
  'review',
  'watchlist',
  'list_item',
]);
export const matchStatus = nitrate.enum('match_status', [
  'pending',
  'matched',
  'ambiguous',
  'unmatched',
  'skipped',
  'imported',
  'failed',
]);
export const mediaKind = nitrate.enum('media_kind', ['avatar', 'club_image', 'list_cover']);

/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

export const mediaAssets = nitrate.table(
  'media_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id'),
    kind: mediaKind('kind').notNull(),
    mime: text('mime').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    byteSize: integer('byte_size').notNull(),
    checksum: text('checksum').notNull(),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('media_owner_idx').on(t.ownerUserId)],
);

/* -------------------------------------------------------------------------- */
/* Users & auth                                                               */
/* -------------------------------------------------------------------------- */

export const users = nitrate.table(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    bio: text('bio'),
    location: text('location'),
    websiteUrl: text('website_url'),
    pronouns: text('pronouns'),
    avatarAssetId: uuid('avatar_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    role: userRole('role').notNull().default('member'),
    timezone: text('timezone').notNull().default('UTC'),
    /** ISO-3166-1 alpha-2. Null until resolved once (self-chosen or inferred) — see src/server/services/region.ts. */
    watchRegion: text('watch_region'),

    profileVisibility: visibility('profile_visibility').notNull().default('public'),
    defaultEntryVisibility: visibility('default_entry_visibility').notNull().default('public'),
    showWatchlistPublicly: boolean('show_watchlist_publicly').notNull().default(true),
    allowFollows: boolean('allow_follows').notNull().default(true),
    adultContent: boolean('adult_content').notNull().default(false),

    emailMovieNightReminders: boolean('email_movie_night_reminders').notNull().default(true),
    emailPicksAndVoting: boolean('email_picks_and_voting').notNull().default(true),
    emailWinnerSelected: boolean('email_winner_selected').notNull().default(true),
    tasteCircleFeedEnabled: boolean('taste_circle_feed_enabled').notNull().default(false),
    tasteHighlights: text('taste_highlights').array().notNull().default(sql`ARRAY[]::text[]`),

    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspensionReason: text('suspension_reason'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    followerCount: integer('follower_count').notNull().default(0),
    followingCount: integer('following_count').notNull().default(0),
    filmCount: integer('film_count').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_key').on(sql`lower(${t.email})`),
    uniqueIndex('users_username_key').on(sql`lower(${t.username})`),
    index('users_created_idx').on(t.createdAt),
  ],
);

export const sessions = nitrate.table(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    userAgent: text('user_agent'),
  },
  (t) => [
    uniqueIndex('sessions_token_key').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
    index('sessions_expiry_idx').on(t.expiresAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Movie catalogue                                                            */
/* -------------------------------------------------------------------------- */

export const movies = nitrate.table(
  'movies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull().default('tmdb'),
    providerId: text('provider_id').notNull(),
    slug: text('slug').notNull(),

    title: text('title').notNull(),
    originalTitle: text('original_title'),
    year: integer('year'),
    releaseDate: date('release_date'),
    runtime: integer('runtime'),
    tagline: text('tagline'),
    overview: text('overview'),
    posterPath: text('poster_path'),
    backdropPath: text('backdrop_path'),
    imdbId: text('imdb_id'),
    originalLanguage: text('original_language'),
    releaseStatus: text('release_status'),
    adult: boolean('adult').notNull().default(false),

    providerPopularity: real('provider_popularity').notNull().default(0),
    providerVoteAverage: real('provider_vote_average').notNull().default(0),
    providerVoteCount: integer('provider_vote_count').notNull().default(0),

    // Locally derived community aggregates.
    ratingCount: integer('rating_count').notNull().default(0),
    ratingSum: integer('rating_sum').notNull().default(0),
    ratingHistogram: jsonb('rating_histogram')
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    watchCount: integer('watch_count').notNull().default(0),
    likeCount: integer('like_count').notNull().default(0),
    logCount: integer('log_count').notNull().default(0),
    watchlistCount: integer('watchlist_count').notNull().default(0),

    /** Set once full credits/details have been hydrated from the provider. */
    detailsFetchedAt: timestamp('details_fetched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('movies_provider_key').on(t.provider, t.providerId),
    uniqueIndex('movies_slug_key').on(t.slug),
    index('movies_title_idx').on(sql`lower(${t.title})`),
    index('movies_year_idx').on(t.year),
    index('movies_popularity_idx').on(t.providerPopularity),
    index('movies_rating_idx').on(t.ratingCount, t.ratingSum),
  ],
);

export const genres = nitrate.table(
  'genres',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: text('provider_id').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
  },
  (t) => [uniqueIndex('genres_slug_key').on(t.slug), uniqueIndex('genres_provider_key').on(t.providerId)],
);

export const movieGenres = nitrate.table(
  'movie_genres',
  {
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    genreId: uuid('genre_id')
      .notNull()
      .references(() => genres.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.movieId, t.genreId] }), index('movie_genres_genre_idx').on(t.genreId)],
);

export const people = nitrate.table(
  'people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull().default('tmdb'),
    providerId: text('provider_id').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    profilePath: text('profile_path'),
    knownForDepartment: text('known_for_department'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('people_provider_key').on(t.provider, t.providerId),
    index('people_slug_idx').on(t.slug),
    index('people_name_idx').on(sql`lower(${t.name})`),
  ],
);

export const credits = nitrate.table(
  'credits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    kind: creditKind('kind').notNull(),
    character: text('character'),
    department: text('department'),
    job: text('job'),
    sortOrder: integer('sort_order').notNull().default(999),
  },
  (t) => [
    uniqueIndex('credits_unique_key').on(t.movieId, t.personId, t.kind, sql`coalesce(${t.job}, '')`, sql`coalesce(${t.character}, '')`),
    index('credits_movie_idx').on(t.movieId, t.kind, t.sortOrder),
    index('credits_person_idx').on(t.personId),
  ],
);

/** Cached provider list responses (trending, popular, similar…). */
export const providerCache = nitrate.table(
  'provider_cache',
  {
    key: text('key').primaryKey(),
    payload: jsonb('payload').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('provider_cache_expiry_idx').on(t.expiresAt)],
);

/* -------------------------------------------------------------------------- */
/* Personal film state                                                        */
/* -------------------------------------------------------------------------- */

/**
 * One row per (user, film): the user's *current* relationship with a film.
 * Historical opinions live in `diaryEntries` and are never rewritten.
 */
export const userMovieState = nitrate.table(
  'user_movie_state',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),

    watched: boolean('watched').notNull().default(false),
    watchedAt: timestamp('watched_at', { withTimezone: true }),
    liked: boolean('liked').notNull().default(false),
    likedAt: timestamp('liked_at', { withTimezone: true }),
    rating: smallint('rating'),
    ratedAt: timestamp('rated_at', { withTimezone: true }),
    inWatchlist: boolean('in_watchlist').notNull().default(false),
    watchlistedAt: timestamp('watchlisted_at', { withTimezone: true }),
    /** Private context for a watchlist save, e.g. "Rachel recommended this". Never shown to anyone else. */
    note: text('note'),

    logCount: integer('log_count').notNull().default(0),
    lastWatchedDate: date('last_watched_date'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ums_user_movie_key').on(t.userId, t.movieId),
    index('ums_watchlist_idx').on(t.userId, t.inWatchlist, t.watchlistedAt),
    index('ums_watched_idx').on(t.userId, t.watched),
    index('ums_movie_idx').on(t.movieId),
    index('ums_rating_idx').on(t.movieId, t.rating),
  ],
);

export const favoriteFilms = nitrate.table(
  'favorite_films',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.position] }),
    uniqueIndex('favorites_user_movie_key').on(t.userId, t.movieId),
  ],
);

export const tasteCircleMembers = nitrate.table(
  'taste_circle_members',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    memberUserId: uuid('member_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.memberUserId] }), index('taste_circle_member_idx').on(t.memberUserId)],
);

export const recommendationFeedback = nitrate.table(
  'recommendation_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    targetType: text('target_type').$type<'user' | 'movie' | 'person'>().notNull(),
    targetId: text('target_id').notNull(),
    kind: text('kind').$type<'hide' | 'already_know' | 'less_like_this'>().notNull(),
    reasonKind: text('reason_kind'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    restoredAt: timestamp('restored_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('recommendation_feedback_active_key').on(t.userId, t.targetType, t.targetId, t.kind).where(sql`${t.restoredAt} is null`),
    index('recommendation_feedback_expiry_idx').on(t.userId, t.expiresAt),
  ],
);

export const personFollows = nitrate.table(
  'person_follows',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    personId: uuid('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.personId] }), index('person_follows_person_idx').on(t.personId)],
);

export const tags = nitrate.table(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
  },
  (t) => [uniqueIndex('tags_user_slug_key').on(t.userId, t.slug)],
);

/**
 * A single viewing. Rewatches create additional rows; each keeps the rating and
 * review as they were on that date.
 */
export const diaryEntries = nitrate.table(
  'diary_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),

    watchedDate: date('watched_date').notNull(),
    rating: smallint('rating'),
    liked: boolean('liked').notNull().default(false),
    reviewText: text('review_text'),
    viewingContext: text('viewing_context').$type<ViewingContext>(),
    containsSpoilers: boolean('contains_spoilers').notNull().default(false),
    isRewatch: boolean('is_rewatch').notNull().default(false),
    visibility: visibility('visibility').notNull().default('public'),

    source: entrySource('source').notNull().default('manual'),
    screeningId: uuid('screening_id'),
    importBatchId: uuid('import_batch_id'),
    /** Stable key from an external system; makes re-running an import a no-op. */
    externalKey: text('external_key'),

    likeCount: integer('like_count').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('diary_user_date_idx').on(t.userId, t.watchedDate, t.createdAt),
    index('diary_movie_idx').on(t.movieId, t.createdAt),
    index('diary_review_idx').on(t.movieId, t.likeCount),
    uniqueIndex('diary_external_key').on(t.userId, t.externalKey),
    uniqueIndex('diary_screening_key').on(t.userId, t.screeningId),
  ],
);

export const ownershipCopies = nitrate.table(
  'ownership_copies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
    format: text('format').$type<OwnershipFormat>().notNull(),
    edition: text('edition'),
    notes: text('notes'),
    purchasedOn: date('purchased_on'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ownership_user_movie_idx').on(t.userId, t.movieId),
    index('ownership_user_format_idx').on(t.userId, t.format),
  ],
);

export const diaryEntryTags = nitrate.table(
  'diary_entry_tags',
  {
    diaryEntryId: uuid('diary_entry_id')
      .notNull()
      .references(() => diaryEntries.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.diaryEntryId, t.tagId] }), index('det_tag_idx').on(t.tagId)],
);

export const reviewLikes = nitrate.table(
  'review_likes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    diaryEntryId: uuid('diary_entry_id')
      .notNull()
      .references(() => diaryEntries.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.diaryEntryId] }),
    index('review_likes_entry_idx').on(t.diaryEntryId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Lists                                                                      */
/* -------------------------------------------------------------------------- */

export const lists = nitrate.table(
  'lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    visibility: visibility('visibility').notNull().default('public'),
    isRanked: boolean('is_ranked').notNull().default(false),
    /** Reserved for collaborative lists; the join table already exists. */
    allowCollaborators: boolean('allow_collaborators').notNull().default(false),
    version: integer('version').notNull().default(1),
    isPinned: boolean('is_pinned').notNull().default(false),
    clonedFromListId: uuid('cloned_from_list_id'),

    itemCount: integer('item_count').notNull().default(0),
    likeCount: integer('like_count').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('lists_user_slug_key').on(t.userId, t.slug),
    index('lists_popular_idx').on(t.visibility, t.likeCount),
    index('lists_user_idx').on(t.userId, t.updatedAt),
    index('lists_pinned_idx').on(t.userId, t.isPinned, t.updatedAt),
  ],
);

export const listItems = nitrate.table(
  'list_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    note: text('note'),
    addedByUserId: uuid('added_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('list_items_unique_key').on(t.listId, t.movieId),
    index('list_items_order_idx').on(t.listId, t.position),
    index('list_items_movie_idx').on(t.movieId),
  ],
);

export const listCollaborators = nitrate.table(
  'list_collaborators',
  {
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    canEdit: boolean('can_edit').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.listId, t.userId] })],
);

export const listCollaborationInvitations = nitrate.table(
  'list_collaboration_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
    inviterUserId: uuid('inviter_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    inviteeUserId: uuid('invitee_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<'editor'>().notNull().default('editor'),
    status: text('status').$type<'pending' | 'accepted' | 'declined' | 'revoked' | 'expired'>().notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('list_collab_invite_pending_key').on(t.listId, t.inviteeUserId).where(sql`${t.status} = 'pending'`),
    index('list_collab_invite_inbox_idx').on(t.inviteeUserId, t.status, t.expiresAt),
  ],
);

export const listActivity = nitrate.table(
  'list_activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    action: text('action').$type<'list_updated' | 'item_added' | 'item_removed' | 'note_updated' | 'reordered' | 'collaborator_added' | 'collaborator_removed' | 'cloned' | 'bulk_transferred'>().notNull(),
    listItemId: uuid('list_item_id').references(() => listItems.id, { onDelete: 'set null' }),
    movieId: uuid('movie_id').references(() => movies.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('list_activity_list_time_idx').on(t.listId, t.createdAt)],
);

export const savedLists = nitrate.table(
  'saved_lists',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    listId: uuid('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
    isPinned: boolean('is_pinned').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.listId] }),
    index('saved_lists_user_sort_idx').on(t.userId, t.isPinned, t.createdAt),
  ],
);

export const listLikes = nitrate.table(
  'list_likes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listId] }), index('list_likes_list_idx').on(t.listId)],
);

/* -------------------------------------------------------------------------- */
/* Comments (reviews + lists)                                                 */
/* -------------------------------------------------------------------------- */

export const comments = nitrate.table(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectType: subjectType('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    parentId: uuid('parent_id'),
    body: text('body').notNull(),
    containsSpoilers: boolean('contains_spoilers').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedByUserId: uuid('deleted_by_user_id'),
  },
  (t) => [
    index('comments_subject_idx').on(t.subjectType, t.subjectId, t.createdAt),
    index('comments_user_idx').on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Social graph                                                               */
/* -------------------------------------------------------------------------- */

export const follows = nitrate.table(
  'follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index('follows_following_idx').on(t.followingId, t.createdAt),
  ],
);

export const blocks = nitrate.table(
  'blocks',
  {
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index('blocks_blocked_idx').on(t.blockedId),
  ],
);

/**
 * Single append-only stream powering the home feed. One row per socially
 * interesting thing that happened, denormalised enough that rendering a page of
 * feed never fans out into per-type queries.
 */
export const activityEvents = nitrate.table(
  'activity_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: activityType('type').notNull(),
    visibility: visibility('visibility').notNull().default('public'),

    movieId: uuid('movie_id').references(() => movies.id, { onDelete: 'cascade' }),
    diaryEntryId: uuid('diary_entry_id').references(() => diaryEntries.id, { onDelete: 'cascade' }),
    listId: uuid('list_id').references(() => lists.id, { onDelete: 'cascade' }),
    clubId: uuid('club_id'),
    screeningId: uuid('screening_id'),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'cascade' }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('activity_actor_idx').on(t.actorId, t.createdAt),
    index('activity_created_idx').on(t.createdAt),
    index('activity_club_idx').on(t.clubId, t.createdAt),
    index('activity_movie_idx').on(t.movieId, t.createdAt),
  ],
);

export const notifications = nitrate.table(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    subjectType: subjectType('subject_type'),
    subjectId: uuid('subject_id'),
    clubId: uuid('club_id'),
    body: text('body'),
    url: text('url').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    /** Collapses duplicates (e.g. "voting is closing" fired by two triggers). */
    dedupeKey: text('dedupe_key'),
    groupKey: text('group_key'),
    groupCount: integer('group_count').notNull().default(1),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId, t.createdAt),
    index('notifications_unread_idx').on(t.userId, t.readAt),
    uniqueIndex('notifications_dedupe_key').on(t.userId, t.dedupeKey),
    index('notifications_group_idx').on(t.userId, t.groupKey, t.createdAt),
    uniqueIndex('notifications_active_group_key').on(t.userId, t.groupKey).where(sql`${t.groupKey} is not null`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Movie Clubs                                                                */
/* -------------------------------------------------------------------------- */

export const clubs = nitrate.table(
  'clubs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    imageAssetId: uuid('image_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
    visibility: clubVisibility('visibility').notNull().default('private'),
    timezone: text('timezone').notNull().default('UTC'),
    interests: text('interests').array().notNull().default(sql`ARRAY[]::text[]`),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    inviteCode: text('invite_code').notNull(),

    /**
     * Optional weekly ritual: open a submissions round automatically, then let
     * the club spin for a winner. Day is 0=Sunday, hour is in the club timezone.
     */
    weeklyPickEnabled: boolean('weekly_pick_enabled').notNull().default(false),
    weeklyPickDay: smallint('weekly_pick_day').notNull().default(1),
    weeklyPickHour: smallint('weekly_pick_hour').notNull().default(18),
    weeklyPickLastOpenedAt: timestamp('weekly_pick_last_opened_at', { withTimezone: true }),

    /**
     * When on (the default), a member sees no score for a film they have not
     * rated yet — not the group average, not anyone else's stars, not on the
     * dashboard, the history or the film page. Turning it off makes ratings
     * visible immediately, for clubs that would rather just talk.
     */
    blindRatingsEnabled: boolean('blind_ratings_enabled').notNull().default(true),
    joinPolicy: text('join_policy').$type<'invite_only' | 'request' | 'open'>().notNull().default('invite_only'),

    memberCount: integer('member_count').notNull().default(1),
    screeningCount: integer('screening_count').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('clubs_slug_key').on(t.slug),
    uniqueIndex('clubs_invite_code_key').on(t.inviteCode),
    index('clubs_visibility_idx').on(t.visibility, t.memberCount),
  ],
);

export const clubJoinRequests = nitrate.table(
  'club_join_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id').notNull().references(() => clubs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').$type<'pending' | 'approved' | 'declined' | 'withdrawn'>().notNull().default('pending'),
    message: text('message'),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('club_join_requests_pending_key').on(t.clubId, t.userId).where(sql`${t.status} = 'pending'`),
    index('club_join_requests_club_idx').on(t.clubId, t.status, t.createdAt),
    index('club_join_requests_user_idx').on(t.userId, t.status, t.createdAt),
  ],
);

export const clubMembers = nitrate.table(
  'club_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: clubRole('role').notNull().default('member'),
    status: clubMemberStatus('status').notNull().default('active'),
    notificationsMuted: boolean('notifications_muted').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('club_members_key').on(t.clubId, t.userId),
    index('club_members_user_idx').on(t.userId, t.status),
  ],
);

export const clubInvites = nitrate.table(
  'club_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    invitedUserId: uuid('invited_user_id').references(() => users.id, { onDelete: 'cascade' }),
    maxUses: integer('max_uses'),
    useCount: integer('use_count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('club_invites_code_key').on(t.code),
    index('club_invites_club_idx').on(t.clubId),
    index('club_invites_user_idx').on(t.invitedUserId),
  ],
);

export const clubQueueItems = nitrate.table(
  'club_queue_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    addedByUserId: uuid('added_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('club_queue_key').on(t.clubId, t.movieId),
    index('club_queue_club_idx').on(t.clubId, t.createdAt),
  ],
);

export const selectionRounds = nitrate.table(
  'selection_rounds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    title: text('title'),
    status: roundStatus('status').notNull().default('draft'),
    mode: selectionMode('mode').notNull().default('vote'),
    nominationLimitPerMember: smallint('nomination_limit_per_member').notNull().default(1),
    nominationsCloseAt: timestamp('nominations_close_at', { withTimezone: true }),
    /** Set by an admin when an incomplete round should proceed with the picks in. */
    picksClosedAt: timestamp('picks_closed_at', { withTimezone: true }),
    votingCloseAt: timestamp('voting_close_at', { withTimezone: true }),
    winnerNominationId: uuid('winner_nomination_id'),

    /**
     * Set the instant the wheel resolves. Both are written in the same
     * transaction as the winner, which is what makes a spin un-re-rollable —
     * and the seed lets the client animate to a result it did not choose.
     */
    spunAt: timestamp('spun_at', { withTimezone: true }),
    spinSeed: text('spin_seed'),
    tieBreak: text('tie_break').notNull().default('earliest_nomination'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('rounds_club_number_key').on(t.clubId, t.roundNumber),
    index('rounds_club_status_idx').on(t.clubId, t.status),
  ],
);

export const nominations = nitrate.table(
  'nominations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => selectionRounds.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    nominatedByUserId: uuid('nominated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pitch: text('pitch'),
    voteCount: integer('vote_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('nominations_round_movie_key').on(t.roundId, t.movieId),
    index('nominations_round_idx').on(t.roundId, t.createdAt),
    index('nominations_user_idx').on(t.nominatedByUserId),
  ],
);

export const votes = nitrate.table(
  'votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => selectionRounds.id, { onDelete: 'cascade' }),
    nominationId: uuid('nomination_id')
      .notNull()
      .references(() => nominations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One eligible vote per member per round.
    uniqueIndex('votes_round_user_key').on(t.roundId, t.userId),
    index('votes_nomination_idx').on(t.nominationId),
  ],
);

/**
 * An optional step between a winner being chosen and a screening being
 * scheduled: an admin proposes several times, members mark availability, and
 * the strongest slot is confirmed. The round stays in `winner_selected` for
 * the whole lifetime of a poll — a poll never creates a screening itself,
 * only `scheduleScreening` does (see services/clubs.ts).
 */
export const screeningPolls = nitrate.table(
  'screening_polls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    roundId: uuid('round_id')
      .notNull()
      .references(() => selectionRounds.id, { onDelete: 'cascade' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    timezone: text('timezone').notNull().default('UTC'),
    status: pollStatus('status').notNull().default('open'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [
    index('polls_club_idx').on(t.clubId),
    index('polls_round_idx').on(t.roundId),
    uniqueIndex('polls_one_open_per_round').on(t.roundId).where(sql`${t.status} = 'open'`),
  ],
);

export const screeningPollOptions = nitrate.table(
  'screening_poll_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pollId: uuid('poll_id')
      .notNull()
      .references(() => screeningPolls.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    sortOrder: smallint('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('poll_options_poll_idx').on(t.pollId, t.sortOrder),
    uniqueIndex('poll_options_time_key').on(t.pollId, t.startsAt),
  ],
);

export const screeningPollResponses = nitrate.table(
  'screening_poll_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    optionId: uuid('option_id')
      .notNull()
      .references(() => screeningPollOptions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    availability: pollAvailability('availability').notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('poll_response_key').on(t.optionId, t.userId),
    index('poll_responses_user_idx').on(t.userId),
  ],
);

export const screenings = nitrate.table(
  'screenings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    roundId: uuid('round_id').references(() => selectionRounds.id, { onDelete: 'set null' }),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    timezone: text('timezone').notNull().default('UTC'),
    location: text('location'),
    watchLink: text('watch_link'),
    notes: text('notes'),
    status: screeningStatus('status').notNull().default('scheduled'),

    groupRatingCount: integer('group_rating_count').notNull().default(0),
    groupRatingSum: integer('group_rating_sum').notNull().default(0),
    attendeeCount: integer('attendee_count').notNull().default(0),
    postCount: integer('post_count').notNull().default(0),

    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
  },
  (t) => [
    index('screenings_club_time_idx').on(t.clubId, t.scheduledAt),
    index('screenings_status_idx').on(t.status, t.scheduledAt),
    index('screenings_movie_idx').on(t.movieId),
  ],
);

export const attendances = nitrate.table(
  'attendances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    screeningId: uuid('screening_id')
      .notNull()
      .references(() => screenings.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rsvp: rsvpStatus('rsvp'),
    attended: boolean('attended'),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('attendance_key').on(t.screeningId, t.userId),
    index('attendance_user_idx').on(t.userId),
  ],
);

/** Blind by default: nobody sees the spread until they've committed a score. */
export const clubRatings = nitrate.table(
  'club_ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    screeningId: uuid('screening_id')
      .notNull()
      .references(() => screenings.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: smallint('rating').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('club_ratings_key').on(t.screeningId, t.userId),
    index('club_ratings_screening_idx').on(t.screeningId),
  ],
);

export const clubDiscussionPosts = nitrate.table(
  'club_discussion_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    screeningId: uuid('screening_id').references(() => screenings.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    containsSpoilers: boolean('contains_spoilers').notNull().default(false),
    replyCount: integer('reply_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedByUserId: uuid('deleted_by_user_id'),
  },
  (t) => [
    index('club_posts_screening_idx').on(t.screeningId, t.createdAt),
    index('club_posts_club_idx').on(t.clubId, t.createdAt),
    index('club_posts_parent_idx').on(t.parentId),
  ],
);

export const clubDiscussionReactions = nitrate.table(
  'club_discussion_reactions',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => clubDiscussionPosts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId, t.emoji] })],
);

export const discussionMentions = nitrate.table(
  'discussion_mentions',
  {
    postId: uuid('post_id').notNull().references(() => clubDiscussionPosts.id, { onDelete: 'cascade' }),
    mentionedUserId: uuid('mentioned_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.mentionedUserId] }),
    index('discussion_mentions_user_idx').on(t.mentionedUserId, t.createdAt),
  ],
);

export const profilePins = nitrate.table(
  'profile_pins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    targetType: text('target_type').$type<'review' | 'list'>().notNull(),
    targetId: uuid('target_id').notNull(),
    position: smallint('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('profile_pins_user_position_key').on(t.userId, t.position),
    uniqueIndex('profile_pins_user_target_key').on(t.userId, t.targetType, t.targetId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Outbound email                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Durable outbox. Mail is written here inside the same transaction as the thing
 * that caused it, then flushed by a worker — so a provider outage delays
 * delivery instead of losing it, and nothing is sent for a rolled-back action.
 */
export const emailDeliveries = nitrate.table(
  'email_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    toEmail: text('to_email').notNull(),
    template: text('template').notNull(),
    subject: text('subject').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: emailStatus('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    /** Collapses duplicate sends, e.g. a spin retried by two tabs at once. */
    dedupeKey: text('dedupe_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => [
    index('email_status_idx').on(t.status, t.createdAt),
    uniqueIndex('email_dedupe_key').on(t.dedupeKey),
  ],
);

/* -------------------------------------------------------------------------- */
/* Revocable public snapshots                                                 */
/* -------------------------------------------------------------------------- */

export const shareSnapshots = nitrate.table(
  'share_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<'personal_recap' | 'club_yearbook' | 'taste_comparison'>().notNull(),
    schemaVersion: smallint('schema_version').notNull().default(1),
    tokenHash: bytea('token_hash').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    sourceUserId: uuid('source_user_id').references(() => users.id, { onDelete: 'cascade' }),
    comparedUserId: uuid('compared_user_id').references(() => users.id, { onDelete: 'cascade' }),
    sourceClubId: uuid('source_club_id').references(() => clubs.id, { onDelete: 'cascade' }),
    sourceYear: smallint('source_year'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('share_snapshots_token_hash_key').on(t.tokenHash),
    index('share_snapshots_owner_idx').on(t.ownerUserId, t.createdAt),
    index('share_snapshots_source_idx').on(t.sourceUserId, t.sourceClubId, t.revokedAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Trust & safety                                                             */
/* -------------------------------------------------------------------------- */

export const reports = nitrate.table(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectType: subjectType('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    subjectOwnerId: uuid('subject_owner_id').references(() => users.id, { onDelete: 'set null' }),
    category: reportCategory('category').notNull(),
    details: text('details'),
    status: reportStatus('status').notNull().default('open'),
    /** Snapshot of the content at report time, so moderation survives deletion. */
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    resolutionNote: text('resolution_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    index('reports_status_idx').on(t.status, t.createdAt),
    index('reports_subject_idx').on(t.subjectType, t.subjectId),
    uniqueIndex('reports_reporter_subject_key').on(t.reporterId, t.subjectType, t.subjectId),
  ],
);

export const moderationActions = nitrate.table(
  'moderation_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    subjectType: subjectType('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    reportId: uuid('report_id').references(() => reports.id, { onDelete: 'set null' }),
    reason: text('reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('mod_actions_subject_idx').on(t.subjectType, t.subjectId),
    index('mod_actions_actor_idx').on(t.actorUserId, t.createdAt),
  ],
);

export const rateLimits = nitrate.table('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull().default(0),
});

/* -------------------------------------------------------------------------- */
/* Letterboxd import                                                          */
/* -------------------------------------------------------------------------- */

export const importBatches = nitrate.table(
  'import_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('letterboxd'),
    status: importStatus('status').notNull().default('uploaded'),
    fileNames: text('file_names').array().notNull().default(sql`ARRAY[]::text[]`),
    totals: jsonb('totals').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    options: jsonb('options').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('import_batches_user_idx').on(t.userId, t.createdAt)],
);

export const importRows = nitrate.table(
  'import_rows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => importBatches.id, { onDelete: 'cascade' }),
    kind: importRowKind('kind').notNull(),
    rawTitle: text('raw_title').notNull(),
    rawYear: integer('raw_year'),
    rawUri: text('raw_uri'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    matchedMovieId: uuid('matched_movie_id').references(() => movies.id, { onDelete: 'set null' }),
    matchStatus: matchStatus('match_status').notNull().default('pending'),
    matchConfidence: real('match_confidence'),
    candidates: jsonb('candidates').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    /** Deterministic per source row; the import upserts on it, so retries are safe. */
    dedupeKey: text('dedupe_key').notNull(),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('import_rows_dedupe_key').on(t.batchId, t.dedupeKey),
    index('import_rows_batch_idx').on(t.batchId, t.matchStatus),
  ],
);

/* -------------------------------------------------------------------------- */
/* Product analytics                                                          */
/* -------------------------------------------------------------------------- */

export const analyticsEvents = nitrate.table(
  'analytics_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    properties: jsonb('properties').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('analytics_name_idx').on(t.name, t.createdAt),
    index('analytics_user_idx').on(t.userId, t.createdAt),
  ],
);

export const productFlags = nitrate.table(
  'product_flags',
  {
    key: text('key').$type<'people' | 'community_lists' | 'public_clubs' | 'community_trends'>().primaryKey(),
    mode: text('mode').$type<'auto' | 'forced_on' | 'forced_off'>().notNull().default('auto'),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }),
    eligibleSince: date('eligible_since'),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }),
    metrics: jsonb('metrics').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export const networkEligibilityDaily = nitrate.table(
  'network_eligibility_daily',
  {
    surface: text('surface').$type<'people' | 'community_lists' | 'public_clubs' | 'community_trends'>().notNull(),
    day: date('day').notNull(),
    eligible: boolean('eligible').notNull(),
    metrics: jsonb('metrics').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.surface, t.day] })],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                  */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ one, many }) => ({
  avatar: one(mediaAssets, { fields: [users.avatarAssetId], references: [mediaAssets.id] }),
  favorites: many(favoriteFilms),
  diaryEntries: many(diaryEntries),
  lists: many(lists),
  clubMemberships: many(clubMembers),
}));

export const moviesRelations = relations(movies, ({ many }) => ({
  genres: many(movieGenres),
  credits: many(credits),
}));

export const movieGenresRelations = relations(movieGenres, ({ one }) => ({
  movie: one(movies, { fields: [movieGenres.movieId], references: [movies.id] }),
  genre: one(genres, { fields: [movieGenres.genreId], references: [genres.id] }),
}));

export const creditsRelations = relations(credits, ({ one }) => ({
  movie: one(movies, { fields: [credits.movieId], references: [movies.id] }),
  person: one(people, { fields: [credits.personId], references: [people.id] }),
}));

export const diaryEntriesRelations = relations(diaryEntries, ({ one, many }) => ({
  user: one(users, { fields: [diaryEntries.userId], references: [users.id] }),
  movie: one(movies, { fields: [diaryEntries.movieId], references: [movies.id] }),
  tags: many(diaryEntryTags),
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
  user: one(users, { fields: [lists.userId], references: [users.id] }),
  items: many(listItems),
}));

export const listItemsRelations = relations(listItems, ({ one }) => ({
  list: one(lists, { fields: [listItems.listId], references: [lists.id] }),
  movie: one(movies, { fields: [listItems.movieId], references: [movies.id] }),
}));

export const clubsRelations = relations(clubs, ({ one, many }) => ({
  owner: one(users, { fields: [clubs.ownerId], references: [users.id] }),
  image: one(mediaAssets, { fields: [clubs.imageAssetId], references: [mediaAssets.id] }),
  members: many(clubMembers),
  queue: many(clubQueueItems),
  rounds: many(selectionRounds),
  screenings: many(screenings),
}));

export const clubMembersRelations = relations(clubMembers, ({ one }) => ({
  club: one(clubs, { fields: [clubMembers.clubId], references: [clubs.id] }),
  user: one(users, { fields: [clubMembers.userId], references: [users.id] }),
}));

export const selectionRoundsRelations = relations(selectionRounds, ({ one, many }) => ({
  club: one(clubs, { fields: [selectionRounds.clubId], references: [clubs.id] }),
  nominations: many(nominations),
  votes: many(votes),
}));

export const nominationsRelations = relations(nominations, ({ one, many }) => ({
  round: one(selectionRounds, { fields: [nominations.roundId], references: [selectionRounds.id] }),
  movie: one(movies, { fields: [nominations.movieId], references: [movies.id] }),
  nominatedBy: one(users, { fields: [nominations.nominatedByUserId], references: [users.id] }),
  votes: many(votes),
}));

export const screeningPollsRelations = relations(screeningPolls, ({ one, many }) => ({
  club: one(clubs, { fields: [screeningPolls.clubId], references: [clubs.id] }),
  round: one(selectionRounds, { fields: [screeningPolls.roundId], references: [selectionRounds.id] }),
  movie: one(movies, { fields: [screeningPolls.movieId], references: [movies.id] }),
  options: many(screeningPollOptions),
}));

export const screeningPollOptionsRelations = relations(screeningPollOptions, ({ one, many }) => ({
  poll: one(screeningPolls, { fields: [screeningPollOptions.pollId], references: [screeningPolls.id] }),
  responses: many(screeningPollResponses),
}));

export const screeningPollResponsesRelations = relations(screeningPollResponses, ({ one }) => ({
  option: one(screeningPollOptions, {
    fields: [screeningPollResponses.optionId],
    references: [screeningPollOptions.id],
  }),
  user: one(users, { fields: [screeningPollResponses.userId], references: [users.id] }),
}));

export const screeningsRelations = relations(screenings, ({ one, many }) => ({
  club: one(clubs, { fields: [screenings.clubId], references: [clubs.id] }),
  movie: one(movies, { fields: [screenings.movieId], references: [movies.id] }),
  attendances: many(attendances),
  ratings: many(clubRatings),
  posts: many(clubDiscussionPosts),
}));

/* -------------------------------------------------------------------------- */
/* Inferred types                                                             */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type Movie = typeof movies.$inferSelect;
export type NewMovie = typeof movies.$inferInsert;
export type Person = typeof people.$inferSelect;
export type Credit = typeof credits.$inferSelect;
export type UserMovieState = typeof userMovieState.$inferSelect;
export type ViewingContext = 'cinema' | 'home' | 'friend_home' | 'club' | 'festival' | 'travel' | 'other';
export type OwnershipFormat = '4k_uhd' | 'blu_ray' | 'dvd' | 'digital' | 'other';
export type OwnershipCopy = typeof ownershipCopies.$inferSelect;
export type RecommendationFeedback = typeof recommendationFeedback.$inferSelect;
export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type List = typeof lists.$inferSelect;
export type ListItem = typeof listItems.$inferSelect;
export type Club = typeof clubs.$inferSelect;
export type ClubMember = typeof clubMembers.$inferSelect;
export type ClubQueueItem = typeof clubQueueItems.$inferSelect;
export type SelectionRound = typeof selectionRounds.$inferSelect;
export type Nomination = typeof nominations.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type ScreeningPoll = typeof screeningPolls.$inferSelect;
export type ScreeningPollOption = typeof screeningPollOptions.$inferSelect;
export type ScreeningPollResponse = typeof screeningPollResponses.$inferSelect;
export type Screening = typeof screenings.$inferSelect;
export type Attendance = typeof attendances.$inferSelect;
export type ClubRating = typeof clubRatings.$inferSelect;
export type ClubDiscussionPost = typeof clubDiscussionPosts.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ActivityEvent = typeof activityEvents.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
export type ImportRow = typeof importRows.$inferSelect;
export type EmailDelivery = typeof emailDeliveries.$inferSelect;
export type ShareSnapshotRow = typeof shareSnapshots.$inferSelect;
export type ProductFlag = typeof productFlags.$inferSelect;
export type ClubJoinRequest = typeof clubJoinRequests.$inferSelect;
export type ProfilePin = typeof profilePins.$inferSelect;
