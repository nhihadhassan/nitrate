import 'server-only';

/** Base class for failures that are safe to show a user verbatim. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = 'app_error', status = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export class AuthError extends AppError {
  constructor(message = 'You need to be signed in.') {
    super(message, 'unauthenticated', 401);
    this.name = 'AuthError';
  }
}

export class PermissionError extends AppError {
  constructor(message = 'You do not have permission to do that.') {
    super(message, 'forbidden', 403);
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found.') {
    super(message, 'not_found', 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  readonly fields: Record<string, string>;
  constructor(message = 'Please check the highlighted fields.', fields: Record<string, string> = {}) {
    super(message, 'validation_error', 422);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export class ConflictError extends AppError {
  constructor(message = 'That conflicts with something that already exists.') {
    super(message, 'conflict', 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'You are doing that too quickly. Give it a moment.') {
    super(message, 'rate_limited', 429);
    this.name = 'RateLimitError';
  }
}

export class ProviderError extends AppError {
  constructor(message = 'The film database is temporarily unavailable.') {
    super(message, 'provider_unavailable', 503);
    this.name = 'ProviderError';
  }
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; code: string; fields?: Record<string, string> };

/** Wraps a server action so thrown AppErrors become typed results, not 500s. */
export async function actionGuard<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data } as ActionResult<T>;
  } catch (error) {
    if (error instanceof ValidationError) {
      return { ok: false, error: error.message, code: error.code, fields: error.fields };
    }
    if (error instanceof AppError) {
      return { ok: false, error: error.message, code: error.code };
    }
    // Anything unexpected: log the detail, return something generic.
    console.error('[action] unhandled error', error);
    return { ok: false, error: 'Something went wrong. Please try again.', code: 'internal_error' };
  }
}
