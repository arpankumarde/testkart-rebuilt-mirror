import { jwtVerify, SignJWT } from "jose";
import { AdminProfile, AdminRole } from "./AdminTypes";
import { db } from "./db";

const encoder = new TextEncoder();
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET environment variable is not set");
}

const secretKey = encoder.encode(secret);
const AdminCookieName = "admin_session";
const AdminSessionExpiration = "90d";
const AdminSessionExpirationSeconds = 60 * 60 * 24 * 90; // 90 days

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

export async function getAdminServerSessionOrThrow(
  request: Request,
  allowedRoles?: AdminRole[]
): Promise<AdminProfile> {
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
  const sessionCookie = cookies[AdminCookieName];

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

    if (payload.iat) {
      const adminRecord = await db
        .selectFrom("admins")
        .select("sessionInvalidatedAt")
        .where("id", "=", adminProfile.id)
        .executeTakeFirst();

      if (
        adminRecord?.sessionInvalidatedAt &&
        payload.iat * 1000 < new Date(adminRecord.sessionInvalidatedAt).getTime()
      ) {
        throw new NotAuthenticatedError("Session has been invalidated");
      }
    }

    if (allowedRoles && !allowedRoles.includes(adminProfile.role)) {
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
 * Sign an admin session JWT. Defaults to the 90-day browser session lifetime; the MCP connector
 * passes a short expiration because it mints a token per request rather than storing one.
 */
export async function createAdminSessionToken(
  admin: AdminProfile,
  expiration: string = AdminSessionExpiration
): Promise<string> {
  return new SignJWT({ admin })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(secretKey);
}

export async function setAdminServerSession(
  response: Response,
  admin: AdminProfile
): Promise<void> {
  const token = await createAdminSessionToken(admin);

  const cookieValue = [
        `${AdminCookieName}=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${AdminSessionExpirationSeconds}`,
  ].join("; ");

  response.headers.append("Set-Cookie", cookieValue);
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