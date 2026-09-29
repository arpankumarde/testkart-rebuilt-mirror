import { sql } from "kysely";
import { db } from "./db";

/**
 * Admins who look after teacher accounts. Teachers who already existed were placed by
 * tier on 07-10-2026 (high earners to Param and Shivangi, large low-priced catalogues to
 * Meet, everyone else to Abhishek); teachers who join after that rotate through the pool.
 */
export const RELATIONSHIP_MANAGER_EMAILS = [
  "abhishek.gupta@testkart.in",
  "param@testkart.in",
  "shivangi.malviya@testkart.in",
  "meet.tomar@testkart.in",
];

// Only signups after the backfill count toward the rotation, so the backfilled
// split does not decide who gets the next new teacher.
const ROTATION_STARTED_AT = new Date("2026-10-07T04:10:00Z");

export type RelationshipManager = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

/**
 * Gives a teacher a relationship manager when they have none, or when theirs has been
 * deactivated. The pick is the active pool admin with the fewest rotation signups, so new
 * teachers go round the pool in turn. Never throws.
 */
export async function assignRelationshipManager(userId: number): Promise<void> {
  try {
    const pick = await db
      .selectFrom("admins")
      .select("admins.id")
      .where("admins.email", "in", RELATIONSHIP_MANAGER_EMAILS)
      .where("admins.isActive", "=", true)
      .orderBy(
        sql`(SELECT count(*) FROM users u WHERE u.relationship_manager_admin_id = admins.id AND u.created_at >= ${ROTATION_STARTED_AT})`
      )
      .orderBy(sql`random()`)
      .executeTakeFirst();

    if (!pick) return;

    await db
      .updateTable("users")
      .set({ relationshipManagerAdminId: pick.id })
      .where("id", "=", userId)
      .where((eb) =>
        eb.or([
          eb("relationshipManagerAdminId", "is", null),
          eb(
            "relationshipManagerAdminId",
            "not in",
            eb.selectFrom("admins").select("admins.id").where("admins.isActive", "=", true)
          ),
        ])
      )
      .execute();
  } catch (error) {
    console.error("Failed to assign a relationship manager:", error);
  }
}

const readManager = (teacherId: number) =>
  db
    .selectFrom("users")
    .innerJoin("admins", "admins.id", "users.relationshipManagerAdminId")
    .select(["admins.fullName", "admins.email", "admins.avatarUrl"])
    .where("users.id", "=", teacherId)
    .where("admins.isActive", "=", true)
    .executeTakeFirst();

/** The teacher's relationship manager, assigning one first if they have none. */
export async function getTeacherRelationshipManager(
  teacherId: number
): Promise<RelationshipManager | null> {
  let row = await readManager(teacherId);
  if (!row) {
    await assignRelationshipManager(teacherId);
    row = await readManager(teacherId);
  }
  return row ? { name: row.fullName, email: row.email, avatarUrl: row.avatarUrl } : null;
}
