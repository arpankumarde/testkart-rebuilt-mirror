import { db } from "./db";
import { Kysely, Transaction } from "kysely";
import { DB } from "./schema";
import { slugify } from "./slugify";
import { updateAccountById } from "./accountRows";

const MAX_ATTEMPTS = 5;

type Executor = Transaction<DB> | Kysely<DB>;

/** True when another student or teacher already holds this slug. Slugs stay unique across both sides. */
export async function isSlugTaken(executor: Executor, slug: string, exceptId?: number): Promise<boolean> {
  const taken = await executor
    .selectFrom("students")
    .select("id")
    .where("slug", "=", slug)
    .$if(exceptId !== undefined, (qb) => qb.where("id", "!=", exceptId!))
    .unionAll(
      executor
        .selectFrom("teachers")
        .select("id")
        .where("slug", "=", slug)
        .$if(exceptId !== undefined, (qb) => qb.where("id", "!=", exceptId!))
    )
    .executeTakeFirst();
  return Boolean(taken);
}

/**
 * Generates AND persists a unique slug for an account in one step, retrying on
 * a unique-constraint race: two concurrent signups can both pass the
 * "is this slug taken" check (neither candidate is committed yet), then both
 * try to claim the same slug - the loser's UPDATE throws a unique violation
 * (students_slug_key / teachers_slug_key, or users_slug_key through the sync
 * while users still carries slugs).
 *
 * Writes to students or teachers (whichever holds the id) since the users
 * split; the sync trigger copies it to users.
 *
 * Falls back to `${base}-${userId}` (deterministically unique, since ids
 * are unique and immutable) if it still collides after a few attempts, so
 * this function can never leave an account without a slug.
 */
export async function assignUserSlug(userId: number, displayName: string, trx?: Executor): Promise<string> {
  const queryBuilder = trx ?? db;
  const baseSlug = slugify(displayName) || "user";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

    if (await isSlugTaken(queryBuilder, candidate, userId)) continue;

    try {
      await updateAccountById(queryBuilder, userId, { slug: candidate });
      return candidate;
    } catch (error) {
      // Someone else claimed this exact slug between our check and our
      // update - try the next candidate instead of failing the request.
      console.warn(`Slug candidate "${candidate}" collided for user ${userId}, retrying:`, error);
    }
  }

  // Deterministic, guaranteed-unique fallback - never blocks account creation.
  const fallback = `${baseSlug}-${userId}`;
  await updateAccountById(queryBuilder, userId, { slug: fallback });
  return fallback;
}
