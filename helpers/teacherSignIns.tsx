import { db } from "./db";

/**
 * A teacher's sign-ins on other browsers and devices: live session rows other than the current one.
 * Leaves out the rows behind AI app connections (each token pair has its own, managed under
 * Connected AI apps) and admin "view as teacher" sessions, which are not the teacher's own sign-ins.
 */
const otherSignIns = (userId: number, currentSessionId: string) =>
  db
    .selectFrom("sessions")
    .where("sessions.userId", "=", userId)
    .where("sessions.id", "!=", currentSessionId)
    .where("sessions.impersonatorAdminId", "is", null)
    .where("sessions.expiresAt", ">", new Date())
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom("mcpOauthTokens")
            .select("mcpOauthTokens.id")
            .whereRef("mcpOauthTokens.sessionId", "=", "sessions.id")
        )
      )
    );

export type OtherSignInsSummary = {
  count: number;
  lastActiveAt: Date | null;
};

export async function summariseOtherSignIns(userId: number, currentSessionId: string): Promise<OtherSignInsSummary> {
  const row = await otherSignIns(userId, currentSessionId)
    .select((eb) => [eb.fn.countAll<string>().as("count"), eb.fn.max("sessions.lastAccessed").as("lastActiveAt")])
    .executeTakeFirst();
  return {
    count: Number(row?.count ?? 0),
    lastActiveAt: row?.lastActiveAt ? new Date(row.lastActiveAt) : null,
  };
}

/** Signs the teacher out everywhere except this browser. AI app connections stay connected. */
export async function signOutOtherSignIns(userId: number, currentSessionId: string): Promise<number> {
  const result = await db
    .deleteFrom("sessions")
    .where("id", "in", otherSignIns(userId, currentSessionId).select("sessions.id"))
    .executeTakeFirst();
  return Number(result.numDeletedRows);
}