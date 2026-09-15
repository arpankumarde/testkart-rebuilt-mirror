import { db } from "./db";
import type { AiConnection } from "./aiConnectors";
import type { McpAudience } from "./mcpOauth";

/**
 * The apps an admin or teacher has connected to their connector, one entry per app name. A token
 * pair counts while it is unrevoked and its refresh token unexpired, and for teachers while the
 * session row behind it still exists - the same rules resolveAccessToken and refreshAccessToken
 * apply. Reconnecting from the same app leaves several live pairs, hence the grouping.
 */
export async function listMcpConnections(audience: McpAudience, principalId: number): Promise<AiConnection[]> {
  const now = new Date();
  const base = db
    .selectFrom("mcpOauthTokens")
    .innerJoin("mcpOauthClients", "mcpOauthClients.clientId", "mcpOauthTokens.clientId")
    .leftJoin("sessions", "sessions.id", "mcpOauthTokens.sessionId")
    .select([
      "mcpOauthClients.clientName",
      "mcpOauthTokens.lastUsedAt",
      "mcpOauthTokens.createdAt",
      "sessions.id as liveSessionId",
    ])
    .where("mcpOauthTokens.audience", "=", audience)
    .where("mcpOauthTokens.revokedAt", "is", null)
    .where((eb) =>
      eb.or([eb("mcpOauthTokens.refreshExpiresAt", "is", null), eb("mcpOauthTokens.refreshExpiresAt", ">", now)])
    );

  const rows = await (audience === "admin"
    ? base.where("mcpOauthTokens.adminId", "=", principalId)
    : base.where("mcpOauthTokens.userId", "=", principalId)
  ).execute();

  const lastUse = new Map<string, Date>();
  for (const row of rows) {
    if (audience === "teacher" && !row.liveSessionId) continue;
    const used = new Date(row.lastUsedAt ?? row.createdAt);
    const seen = lastUse.get(row.clientName);
    if (!seen || used > seen) lastUse.set(row.clientName, used);
  }

  return [...lastUse.entries()]
    .map(([clientName, lastUsedAt]) => ({ clientName, lastUsedAt }))
    .sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime());
}