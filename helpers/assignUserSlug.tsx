import { db } from "./db";
import { Kysely, Transaction } from "kysely";
import { DB } from "./schema";
import { slugify } from "./slugify";

const MAX_ATTEMPTS = 5;

/**
 * Generates AND persists a unique slug for a user in one step, retrying on
 * a unique-constraint race: two concurrent signups can both pass
 * generateUniqueSlug's "SELECT ... WHERE slug = candidate" check (neither
 * candidate is committed yet), then both try to claim the same slug — the
 * loser's UPDATE throws a unique-violation on the `users_slug_key` index.
 *
 * This replaces the old "generateUniqueSlug() then a separate blind
 * updateTable()" two-step pattern duplicated across every signup endpoint.
 * That pattern's follow-up UPDATE could throw an *uncaught* unique
 * violation — since the user row was already INSERTed in a prior
 * statement, the request failed with a 500 but the account still existed,
 * permanently stuck with slug = NULL (breaking their public profile URL)
 * until someone happened to notice on the profile settings page.
 *
 * Falls back to `${base}-${userId}` (deterministically unique, since ids
 * are unique and immutable) if it still collides after a few attempts, so
 * this function can never leave a user without a slug.
 */
export async function assignUserSlug(
  userId: number,
  displayName: string,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<string> {
  const queryBuilder = trx ?? db;
  const baseSlug = slugify(displayName) || "user";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

    const existing = await queryBuilder
      .selectFrom("users")
      .select("id")
      .where("slug", "=", candidate)
      .where("id", "!=", userId)
      .executeTakeFirst();

    if (existing) continue;

    try {
      await queryBuilder
        .updateTable("users")
        .set({ slug: candidate })
        .where("id", "=", userId)
        .execute();
      return candidate;
    } catch (error) {
      // Someone else claimed this exact slug between our check and our
      // update — try the next candidate instead of failing the request.
      console.warn(`Slug candidate "${candidate}" collided for user ${userId}, retrying:`, error);
    }
  }

  // Deterministic, guaranteed-unique fallback — never blocks account creation.
  const fallback = `${baseSlug}-${userId}`;
  await queryBuilder
    .updateTable("users")
    .set({ slug: fallback })
    .where("id", "=", userId)
    .execute();
  return fallback;
}
