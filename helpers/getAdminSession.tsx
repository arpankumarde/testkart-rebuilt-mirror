import { createHash, randomBytes } from "crypto";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { AdminProfile, AdminRole } from "./AdminTypes";
import { adminApiRouteKey, canCallAdminApi, normalizeAdminPermissions } from "./adminPermissions";
import { db } from "./db";
import { getClientIp } from "./getClientIp";

const encoder = new TextEncoder();
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET environment variable is not set");
}

const secretKey = encoder.encode(secret);
const AdminCookieName = "admin_session";
const AdminSessionExpiration = "90d";
const AdminSessionExpirationSeconds = 60 * 60 * 24 * 90; // 90 days
// A super admin signed in as another admin is returned to their own account after this long.
const ImpersonationSeconds = 60 * 60 * 2;

// Browser cookies last 90 days; the MCP connector's per-request tokens last minutes.
const BROWSER_TOKEN_MIN_SECONDS = 60 * 60 * 24;
const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;
const USER_AGENT_MAX_LENGTH = 500;

// Re-export AdminProfile for backward compatibility
export type { AdminProfile };

export class NotAuthenticatedError extends Error {
  constructor(message?: string) {
    super(message ?? "Not authenticated");
    this.name = "NotAuthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message?: string) {
    super(message ?? "Access denied");
    this.name = "ForbiddenError";
  }
}

function readAdminCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = cookieHeader
    .split(";")
    .reduce((cookies: Record<string, string>, cookie) => {
      const [name, value] = cookie.trim().split("=");
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
      return cookies;
    }, {});
  return cookies[AdminCookieName];
}

type TokenSession = { id: string; legacy: boolean };

/**
 * The admin_sessions row a token belongs to. Cookies issued since sessions were recorded carry the
 * row id as `sid`. Older browser cookies have none, so theirs is derived from the admin and the
 * issue time and the row is created the first time the cookie is seen. Short-lived tokens without
 * a sid (the MCP connector mints one per request) are not browser sign-ins and get no row.
 */
function tokenSession(payload: JWTPayload, adminId: number): TokenSession | null {
  if (typeof payload.sid === "string" && payload.sid) {
    return { id: payload.sid, legacy: false };
  }
  if (payload.iat && payload.exp && payload.exp - payload.iat > BROWSER_TOKEN_MIN_SECONDS) {
    const digest = createHash("sha256").update(`${adminId}:${payload.iat}`).digest("hex").slice(0, 32);
    return { id: `legacy-${digest}`, legacy: true };
  }
  return null;
}

/** The super admin behind a "sign in as" session and their own session, to return to. */
type Impersonation = { id: number; sid: string; name: string };

function tokenImpersonation(payload: JWTPayload): Impersonation | undefined {
  const imp = payload.imp as Partial<Impersonation> | undefined;
  if (!imp || typeof imp.id !== "number" || typeof imp.sid !== "string") return undefined;
  return { id: imp.id, sid: imp.sid, name: typeof imp.name === "string" ? imp.name : "A super admin" };
}

function requestUserAgent(request: Request): string | null {
  const userAgent = request.headers.get("user-agent")?.trim();
  return userAgent ? userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null;
}

type RequestSession = { id: string; exp?: number; impersonation?: Impersonation };

const requestSessions = new WeakMap<Request, RequestSession>();

/** The admin_sessions id behind a request that has passed getAdminServerSessionOrThrow. */
export function getAdminSessionId(request: Request): string | undefined {
  return requestSessions.get(request)?.id;
}

/**
 * Verifies the admin session and checks the admin's module permissions for the endpoint being
 * called (helpers/adminPermissions API_RULES, matched on the request path). allowedRoles only
 * applies to non-admin endpoints that also accept an admin session; admin endpoints are gated by
 * permissions alone. Role and permissions are read fresh from the database on every call, and so
 * is the sign-in's admin_sessions row: a revoked or missing row ends the session.
 *
 * When a super admin is signed in as this admin, the profile carries `impersonator`.
 */
export async function getAdminServerSessionOrThrow(
  request: Request,
  allowedRoles?: AdminRole[]
): Promise<AdminProfile> {
  const sessionCookie = readAdminCookie(request);

  if (!sessionCookie) {
    throw new NotAuthenticatedError();
  }
  try {
    const { payload } = await jwtVerify(sessionCookie, secretKey);
    const adminProfile = payload.admin as AdminProfile;

    // Backward compatibility: migrate old JWT format that had isSuperAdmin instead of role
    const profileAny = adminProfile as any;
    if (!adminProfile.role && profileAny.isSuperAdmin !== undefined) {
      (adminProfile as any).role = profileAny.isSuperAdmin ? "super_admin" : "admin";
      delete profileAny.isSuperAdmin;
    }

    const session = tokenSession(payload, adminProfile.id);

    const adminRecord = await db
      .selectFrom("admins")
      .leftJoin("adminSessions", (join) =>
        join.onRef("adminSessions.adminId", "=", "admins.id").on("adminSessions.id", "=", session?.id ?? "")
      )
      .select([
        "admins.sessionInvalidatedAt",
        "admins.isActive",
        "admins.role",
        "admins.permissions",
        "adminSessions.id as sessionRowId",
        "adminSessions.revokedAt as sessionRevokedAt",
        "adminSessions.lastSeenAt as sessionLastSeenAt",
      ])
      .where("admins.id", "=", adminProfile.id)
      .executeTakeFirst();

    if (!adminRecord || adminRecord.isActive === false) {
      throw new NotAuthenticatedError();
    }

    if (
      payload.iat &&
      adminRecord.sessionInvalidatedAt &&
      payload.iat * 1000 < new Date(adminRecord.sessionInvalidatedAt).getTime()
    ) {
      throw new NotAuthenticatedError("Session has been invalidated");
    }

    delete adminProfile.impersonator;

    if (session) {
      if (adminRecord.sessionRowId) {
        if (adminRecord.sessionRevokedAt) {
          throw new NotAuthenticatedError("This session was signed out");
        }
        const lastSeen = adminRecord.sessionLastSeenAt ? new Date(adminRecord.sessionLastSeenAt).getTime() : 0;
        if (Date.now() - lastSeen > LAST_SEEN_REFRESH_MS) {
          await db
            .updateTable("adminSessions")
            .set({ lastSeenAt: new Date(), ipAddress: getClientIp(request), userAgent: requestUserAgent(request) })
            .where("id", "=", session.id)
            .execute()
            .catch((error) => console.error("Admin session last-seen update failed:", error));
        }
      } else if (session.legacy && payload.iat && payload.exp) {
        await db
          .insertInto("adminSessions")
          .values({
            id: session.id,
            adminId: adminProfile.id,
            createdAt: new Date(payload.iat * 1000),
            lastSeenAt: new Date(),
            expiresAt: new Date(payload.exp * 1000),
            ipAddress: getClientIp(request),
            userAgent: requestUserAgent(request),
          })
          .onConflict((oc) => oc.column("id").doNothing())
          .execute();
      } else {
        throw new NotAuthenticatedError("This session was signed out");
      }
      const impersonation = tokenImpersonation(payload);
      requestSessions.set(request, { id: session.id, exp: payload.exp, impersonation });
      if (impersonation) {
        adminProfile.impersonator = { id: impersonation.id, fullName: impersonation.name };
      }
    }

    adminProfile.role = adminRecord.role;
    adminProfile.permissions = normalizeAdminPermissions(adminRecord.permissions);

    const routeKey = adminApiRouteKey(new URL(request.url).pathname);
    const isAdminEndpoint = routeKey.startsWith("admin/") || routeKey === "live-tests/distribute-prizes";

    if (isAdminEndpoint) {
      if (!canCallAdminApi(adminProfile.permissions, routeKey)) {
        throw new ForbiddenError("Access denied: your admin account does not have access to this section");
      }
    } else if (allowedRoles && !allowedRoles.includes(adminProfile.role)) {
      throw new ForbiddenError("Access denied: insufficient permissions");
    }

    return adminProfile;
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      throw error;
    }
    if (error instanceof ForbiddenError) {
      throw error;
    }
    console.error("Admin JWT verification failed:", error);
    throw new NotAuthenticatedError();
  }
}

/**
 * For actions on other admins' sign-ins. The role is the one read from the database, and a super
 * admin who is signed in as someone else has to return to their own account first.
 */
export function assertSuperAdmin(admin: AdminProfile): void {
  if (admin.role !== "super_admin" || admin.impersonator) {
    throw new ForbiddenError("Only a super admin can do this from their own account.");
  }
}

/**
 * Sign an admin session JWT. Defaults to the 90-day browser session lifetime; the MCP connector
 * passes a short expiration because it mints a token per request rather than storing one, and
 * leaves out sessionId because those tokens are not sign-ins.
 */
export async function createAdminSessionToken(
  admin: AdminProfile,
  expiration: string = AdminSessionExpiration,
  sessionId?: string,
  impersonation?: Impersonation
): Promise<string> {
  return new SignJWT({
    admin,
    ...(sessionId ? { sid: sessionId } : {}),
    ...(impersonation ? { imp: impersonation } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(secretKey);
}

async function issueAdminCookie(
  response: Response,
  admin: AdminProfile,
  request: Request,
  options: { sessionId: string; lifetimeSeconds: number; impersonation?: Impersonation }
): Promise<void> {
  const { sessionId, lifetimeSeconds, impersonation } = options;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + lifetimeSeconds * 1000);
  const ipAddress = getClientIp(request);
  const userAgent = requestUserAgent(request);

  await db
    .insertInto("adminSessions")
    .values({
      id: sessionId,
      adminId: admin.id,
      impersonatorAdminId: impersonation?.id ?? null,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      ipAddress,
      userAgent,
    })
    .onConflict((oc) => oc.column("id").doUpdateSet({ lastSeenAt: now, expiresAt, ipAddress, userAgent }))
    .execute();

  // Permissions stay out of the cookie; every session check reads them from the database.
  const { permissions: _permissions, impersonator: _impersonator, ...profile } = admin;
  const token = await createAdminSessionToken(profile, `${lifetimeSeconds}s`, sessionId, impersonation);

  const cookieValue = [
    `${AdminCookieName}=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${lifetimeSeconds}`,
  ].join("; ");

  response.headers.append("Set-Cookie", cookieValue);
}

/**
 * Sets the admin cookie and records the sign-in in admin_sessions. Pass sessionId to re-issue the
 * cookie for a session that already exists (the row keeps its sign-in time); leave it out on login.
 * Re-issuing the request's own "signed in as" session keeps it one, with the time it had left.
 */
export async function setAdminServerSession(
  response: Response,
  admin: AdminProfile,
  request: Request,
  sessionId?: string
): Promise<void> {
  const current = requestSessions.get(request);
  if (sessionId && current?.id === sessionId && current.impersonation) {
    const remaining = current.exp ? current.exp - Math.floor(Date.now() / 1000) : ImpersonationSeconds;
    await issueAdminCookie(response, admin, request, {
      sessionId,
      lifetimeSeconds: Math.max(60, Math.min(remaining, ImpersonationSeconds)),
      impersonation: current.impersonation,
    });
    return;
  }
  await issueAdminCookie(response, admin, request, {
    sessionId: sessionId ?? randomBytes(16).toString("hex"),
    lifetimeSeconds: AdminSessionExpirationSeconds,
  });
}

/**
 * Signs the requesting super admin in as `target` for up to two hours. Their own session is left
 * as it is, and its id travels in the new cookie so endAdminImpersonation can return to it. The
 * caller checks who may do this (assertSuperAdmin) and that the target can be signed in to.
 */
export async function startAdminImpersonation(
  response: Response,
  target: AdminProfile,
  request: Request,
  impersonator: AdminProfile
): Promise<void> {
  const ownSessionId = requestSessions.get(request)?.id;
  if (!ownSessionId) {
    throw new ForbiddenError("Open the admin panel in a browser to sign in as another admin.");
  }
  await issueAdminCookie(response, target, request, {
    sessionId: randomBytes(16).toString("hex"),
    lifetimeSeconds: ImpersonationSeconds,
    impersonation: { id: impersonator.id, sid: ownSessionId, name: impersonator.fullName },
  });
}

/**
 * Ends a "signed in as" session and puts the super admin's own cookie back. If their own session
 * has ended in the meantime the cookie is cleared instead, and they sign in again.
 */
export async function endAdminImpersonation(
  response: Response,
  request: Request
): Promise<"restored" | "signed_out" | "not_impersonating"> {
  const current = requestSessions.get(request);
  if (!current?.impersonation) return "not_impersonating";
  const { id: ownerId, sid: ownerSessionId } = current.impersonation;
  const now = new Date();

  await db
    .updateTable("adminSessions")
    .set({ revokedAt: now })
    .where("id", "=", current.id)
    .where("revokedAt", "is", null)
    .execute();

  const owner = await db
    .selectFrom("admins")
    .innerJoin("adminSessions", "adminSessions.adminId", "admins.id")
    .select([
      "admins.id",
      "admins.email",
      "admins.fullName",
      "admins.role",
      "admins.avatarUrl",
      "admins.avatarFileId",
      "admins.bio",
      "admins.isActive",
      "adminSessions.revokedAt",
      "adminSessions.expiresAt",
    ])
    .where("admins.id", "=", ownerId)
    .where("adminSessions.id", "=", ownerSessionId)
    .executeTakeFirst();

  if (!owner || owner.isActive === false || owner.revokedAt || new Date(owner.expiresAt) <= now) {
    clearAdminServerSession(response);
    return "signed_out";
  }

  await issueAdminCookie(
    response,
    {
      id: owner.id,
      email: owner.email,
      fullName: owner.fullName,
      role: owner.role,
      avatarUrl: owner.avatarUrl,
      avatarFileId: owner.avatarFileId,
      bio: owner.bio,
    },
    request,
    { sessionId: ownerSessionId, lifetimeSeconds: AdminSessionExpirationSeconds }
  );
  return "restored";
}

/** Marks the request's own session as signed out. Safe to call with no cookie or a bad one. */
export async function revokeRequestAdminSession(request: Request): Promise<void> {
  const sessionCookie = readAdminCookie(request);
  if (!sessionCookie) return;
  try {
    const { payload } = await jwtVerify(sessionCookie, secretKey);
    const adminId = (payload.admin as AdminProfile | undefined)?.id;
    if (typeof adminId !== "number") return;
    const session = tokenSession(payload, adminId);
    if (!session) return;
    const now = new Date();
    if (session.legacy && payload.iat && payload.exp) {
      // An older cookie that was never seen has no row yet; without one it would stay usable.
      await db
        .insertInto("adminSessions")
        .values({
          id: session.id,
          adminId,
          createdAt: new Date(payload.iat * 1000),
          lastSeenAt: now,
          expiresAt: new Date(payload.exp * 1000),
          revokedAt: now,
          ipAddress: getClientIp(request),
          userAgent: requestUserAgent(request),
        })
        .onConflict((oc) => oc.column("id").doUpdateSet({ revokedAt: now }))
        .execute();
      return;
    }
    await db
      .updateTable("adminSessions")
      .set({ revokedAt: now })
      .where("id", "=", session.id)
      .where("adminId", "=", adminId)
      .where("revokedAt", "is", null)
      .execute();
  } catch (error) {
    console.error("Admin session could not be marked signed out:", error);
  }
}

export function clearAdminServerSession(response: Response) {
  const cookieValue = [
    `${AdminCookieName}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ].join("; ");

  response.headers.append("Set-Cookie", cookieValue);
}
