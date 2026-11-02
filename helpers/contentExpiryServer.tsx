import { sql, type Kysely, type Transaction } from "kysely";
import { db } from "./db";
import type { ContentType, ContentVisibility, DB } from "./schema";
import { loadContentState } from "./contentReviewQueue";
import { CONTENT_NOUNS } from "./contentReviewStatus";
import { writeContentVisibility } from "./contentVisibilityServer";
import {
  CONTENT_TABLES,
  expiredCartMessage,
  expiredPurchaseMessage,
  expiryCutoff,
  expiryLastDay,
  formatExpiryDay,
  isExpired,
  isPastExpiry,
  listingStatus,
  todayIst,
  type ListingStatus,
} from "./contentExpiry";

/*
 * Server side of product expiry (rules in helpers/contentExpiry). One shared
 * implementation for all five item tables; the columns are the same on each.
 */

type Executor = Kysely<DB> | Transaction<DB>;

const EXPIRY_TABLES = CONTENT_TABLES;

export const EXPIRY_CONTENT_TYPES = Object.keys(EXPIRY_TABLES) as ContentType[];

export class ContentExpiryError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "ContentExpiryError";
  }
}

type ExpiryRow = {
  expiresAt: Date | null;
  expiredAt: Date | null;
  preExpiryVisibility: ContentVisibility | null;
};

async function loadExpiryRow(executor: Executor, contentType: ContentType, contentId: number): Promise<ExpiryRow | null> {
  const { rows } = await sql<ExpiryRow>`
    select expires_at, expired_at, pre_expiry_visibility
    from ${sql.table(EXPIRY_TABLES[contentType])}
    where id = ${contentId}
  `.execute(executor);
  return rows[0] ?? null;
}

/*
 * Unlists every item past its expiry that is not unlisted for it yet, and
 * remembers the visibility it had. Safe to run any number of times: a row is
 * matched again only if something made it public while still expired, which
 * this puts right. A live test's shadow mock test row follows its visibility.
 */
export async function expireDueContent(
  only?: { contentType: ContentType; contentId: number }
): Promise<Record<ContentType, number[]>> {
  const result = {} as Record<ContentType, number[]>;
  const types = only ? [only.contentType] : EXPIRY_CONTENT_TYPES;
  for (const contentType of types) {
    const ids = await db.transaction().execute(async (trx) => {
      const { rows } = await sql<{ id: number }>`
        update ${sql.table(EXPIRY_TABLES[contentType])}
        set pre_expiry_visibility = case when expired_at is null then visibility else coalesce(pre_expiry_visibility, visibility) end,
            visibility = 'unlisted',
            expired_at = coalesce(expired_at, now()),
            updated_at = now()
        where expires_at <= now()
          and (expired_at is null or visibility = 'public')
          ${only ? sql`and id = ${only.contentId}` : sql``}
        returning id
      `.execute(trx);
      const changed = rows.map((r) => r.id);
      if (contentType === "live_test" && changed.length > 0) {
        await sql`
          update mock_tests set visibility = 'unlisted', updated_at = now()
          where id in (select mock_test_id from live_tests where id in (${sql.join(changed)}))
        `.execute(trx);
      }
      return changed;
    });
    result[contentType] = ids;
  }
  return result;
}

export type ContentExpiryStatus = {
  /** Last day on sale (YYYY-MM-DD, IST), or null when no expiry is set. */
  expiryDay: string | null;
  expiresAt: Date | null;
  /** When the item was unlisted for expiry; null while it is not. */
  expiredAt: Date | null;
  expired: boolean;
  status: ListingStatus;
  /** The visibility Relist restores. */
  relistVisibility: ContentVisibility;
  /** Relist is allowed now: expired, with no expiry date left in the past. */
  canRelist: boolean;
  live: boolean;
  visibility: ContentVisibility;
  title: string;
};

async function ownedState(contentType: ContentType, contentId: number, access: ExpiryAccess) {
  const state = await loadContentState(db, contentType, contentId);
  if (!state || (access.kind === "teacher" && state.teacherId !== access.teacherId)) {
    throw new ContentExpiryError(`This ${CONTENT_NOUNS[contentType]} was not found in your account.`, 404);
  }
  return state;
}

/** Who is acting: the owning teacher (or a teammate), or an admin cleared for that content type. */
export type ExpiryAccess = { kind: "teacher"; teacherId: number } | { kind: "admin" };

export async function loadContentExpiryStatus(
  contentType: ContentType,
  contentId: number,
  access: ExpiryAccess
): Promise<ContentExpiryStatus> {
  const state = await ownedState(contentType, contentId, access);
  const row = await loadExpiryRow(db, contentType, contentId);
  if (!row) throw new ContentExpiryError("Not found", 404);
  const now = new Date();
  const fields = { expiresAt: row.expiresAt, expiredAt: row.expiredAt };
  const expired = isExpired(fields, now);
  return {
    expiryDay: row.expiresAt ? expiryLastDay(row.expiresAt) : null,
    expiresAt: row.expiresAt,
    expiredAt: row.expiredAt,
    expired,
    status: listingStatus({ ...fields, live: state.live, visibility: state.visibility }, now),
    relistVisibility: row.preExpiryVisibility ?? "public",
    canRelist: expired && !isPastExpiry(row.expiresAt, now),
    live: state.live,
    visibility: state.visibility,
    title: state.title,
  };
}

/*
 * Sets or removes an item's expiry. A new date must be today or later in IST.
 * An item already past its date is unlisted first, so a new date never relists
 * it: that takes an explicit Relist.
 */
export async function setContentExpiry(input: {
  contentType: ContentType;
  contentId: number;
  expiryDay: string | null;
  access: ExpiryAccess;
}): Promise<ContentExpiryStatus> {
  const { contentType, contentId, expiryDay, access } = input;
  await ownedState(contentType, contentId, access);
  const row = await loadExpiryRow(db, contentType, contentId);
  if (!row) throw new ContentExpiryError("Not found", 404);

  const current = row.expiresAt ? expiryLastDay(row.expiresAt) : null;
  if (expiryDay !== null && expiryDay !== current && expiryDay < todayIst()) {
    throw new ContentExpiryError("Pick today or a later date. An expiry date cannot be in the past.");
  }

  if (isPastExpiry(row.expiresAt) && row.expiredAt === null) {
    await expireDueContent({ contentType, contentId });
  }

  if (expiryDay !== current) {
    const expiresAt = expiryDay ? expiryCutoff(expiryDay) : null;
    await sql`
      update ${sql.table(EXPIRY_TABLES[contentType])}
      set expires_at = ${expiresAt}, updated_at = now()
      where id = ${contentId}
    `.execute(db);
  }
  return loadContentExpiryStatus(contentType, contentId, access);
}

/*
 * Puts an expired item back on sale with the visibility it had before it
 * expired. It needs a future expiry date, or none. A live test that has
 * already ended cannot go back on sale.
 */
export async function relistExpiredContent(input: {
  contentType: ContentType;
  contentId: number;
  access: ExpiryAccess;
}): Promise<ContentExpiryStatus> {
  const { contentType, contentId, access } = input;
  const noun = CONTENT_NOUNS[contentType];
  const state = await ownedState(contentType, contentId, access);
  const row = await loadExpiryRow(db, contentType, contentId);
  if (!row) throw new ContentExpiryError("Not found", 404);

  if (!isExpired({ expiresAt: row.expiresAt, expiredAt: row.expiredAt })) {
    throw new ContentExpiryError(`This ${noun} has not expired, so there is nothing to relist.`);
  }
  if (isPastExpiry(row.expiresAt)) {
    throw new ContentExpiryError(
      `Its expiry date (${formatExpiryDay(expiryLastDay(row.expiresAt as Date))}) has passed. Pick a new date or remove it, then relist.`
    );
  }
  if (contentType === "live_test" && state.endTime && state.endTime <= new Date()) {
    throw new ContentExpiryError("This live test has already ended, so it cannot be relisted.");
  }

  const visibility = row.preExpiryVisibility ?? "public";
  await db.transaction().execute(async (trx) => {
    await writeContentVisibility(trx, contentType, contentId, visibility);
    await sql`
      update ${sql.table(EXPIRY_TABLES[contentType])}
      set expired_at = null, pre_expiry_visibility = null, updated_at = now()
      where id = ${contentId}
    `.execute(trx);
  });
  return loadContentExpiryStatus(contentType, contentId, access);
}

/** The message to show when an item can no longer be bought or enrolled in; null while it can. */
export async function expiredPurchaseError(
  executor: Executor,
  contentType: ContentType,
  contentId: number
): Promise<string | null> {
  const { rows } = await sql<{ title: string; expiresAt: Date | null; expiredAt: Date | null }>`
    select title, expires_at, expired_at from ${sql.table(EXPIRY_TABLES[contentType])} where id = ${contentId}
  `.execute(executor);
  const row = rows[0];
  return row && isExpired(row) ? expiredPurchaseMessage(row.title) : null;
}

/** Throws the expired message when an item can no longer be bought or enrolled in. */
export async function assertNotExpired(
  executor: Executor,
  contentType: ContentType,
  contentId: number
): Promise<void> {
  const message = await expiredPurchaseError(executor, contentType, contentId);
  if (message) throw new ContentExpiryError(message);
}

/** Titles of the items in a student's cart that have expired. */
export async function findExpiredCartTitles(executor: Executor, userId: number): Promise<string[]> {
  const { rows } = await sql<{ title: string }>`
    select coalesce(mt.title, c.title, dp.title) as title
    from cart_items ci
    left join mock_tests mt on mt.id = ci.mock_test_id
    left join courses c on c.id = ci.course_id
    left join digital_products dp on dp.id = ci.digital_product_id
    where ci.user_id = ${userId}
      and (
        coalesce(mt.expires_at, c.expires_at, dp.expires_at) <= now()
        or coalesce(mt.expired_at, c.expired_at, dp.expired_at) is not null
      )
  `.execute(executor);
  return rows.map((r) => r.title);
}

/** Throws the cart message when any cart item has expired, so checkout stops before an order exists. */
export async function assertCartNotExpired(executor: Executor, userId: number): Promise<void> {
  const titles = await findExpiredCartTitles(executor, userId);
  if (titles.length > 0) throw new ContentExpiryError(expiredCartMessage(titles));
}

export type ExpiryListRow = {
  contentType: ContentType;
  id: number;
  title: string;
  teacherId: number;
  teacherName: string | null;
  live: boolean;
  visibility: ContentVisibility;
  expiresAt: Date | null;
  expiredAt: Date | null;
  preExpiryVisibility: ContentVisibility | null;
};

/*
 * Every item with an expiry date, or unlisted for one, across the given types.
 * A live test's shadow mock test row is left out; the live test stands for it.
 */
export async function loadExpiryRows(types: ContentType[]): Promise<ExpiryListRow[]> {
  if (types.length === 0) return [];
  const parts = {
    course: sql`
      select 'course' as content_type, t.id, t.title, t.teacher_id, (t.status = 'published') as live,
        t.visibility, t.expires_at, t.expired_at, t.pre_expiry_visibility
      from courses t where t.expires_at is not null or t.expired_at is not null`,
    mock_test: sql`
      select 'mock_test' as content_type, t.id, t.title, t.teacher_id, (t.is_published and t.deleted_at is null) as live,
        t.visibility, t.expires_at, t.expired_at, t.pre_expiry_visibility
      from mock_tests t
      where (t.expires_at is not null or t.expired_at is not null)
        and not exists (select 1 from live_tests lt where lt.mock_test_id = t.id)`,
    digital_product: sql`
      select 'digital_product' as content_type, t.id, t.title, t.teacher_id, (t.status = 'published') as live,
        t.visibility, t.expires_at, t.expired_at, t.pre_expiry_visibility
      from digital_products t where t.expires_at is not null or t.expired_at is not null`,
    course_bundle: sql`
      select 'course_bundle' as content_type, t.id, t.title, t.teacher_id, t.is_published as live,
        t.visibility, t.expires_at, t.expired_at, t.pre_expiry_visibility
      from course_bundles t where t.expires_at is not null or t.expired_at is not null`,
    live_test: sql`
      select 'live_test' as content_type, t.id, t.title, t.teacher_id, t.is_active as live,
        t.visibility, t.expires_at, t.expired_at, t.pre_expiry_visibility
      from live_tests t where t.expires_at is not null or t.expired_at is not null`,
  } as const;
  const union = sql.join(
    types.map((type) => parts[type as keyof typeof parts]),
    sql` union all `
  );
  const { rows } = await sql<Omit<ExpiryListRow, "teacherName">>`
    select x.*, u.display_name as teacher_name
    from (${union}) x
    left join users u on u.id = x.teacher_id
    order by coalesce(x.expired_at, x.expires_at) desc
  `.execute(db);
  return rows as ExpiryListRow[];
}
