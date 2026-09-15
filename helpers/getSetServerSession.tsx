import { jwtVerify, SignJWT } from "jose";

const encoder = new TextEncoder();
const secret = process.env.JWT_SECRET;

export const SessionExpirationSeconds = 60 * 60 * 24 * 90; // 90 days
// Probability to run cleanup (10%)
export const CleanupProbability = 0.1;

// Only send the ID in the cookie to the client
// We should store id -> user id and user data mapping in our database for max security
export interface Session {
  // this should be a crypto random string
  id: string;
  createdAt: number;
  lastAccessed: number;

  // Whether the user needs to change their password
  // Useful for password reset or setting up new user with initial password
  passwordChangeRequired?: boolean;

  // Set when an admin is impersonating a user
  impersonatorAdminId?: number;
}

const CookieName = "floot_built_app_session";

export class NotAuthenticatedError extends Error {
  constructor(message?: string) {
    super(message ?? "Not authenticated");
    this.name = "NotAuthenticatedError";
  }
}

/**
 * Returns the user session or throw an error. Make sure to handle the error (return a proper request)
 */
export async function getServerSessionOrThrow(
  request: Request
): Promise<Session> {
  // Note: if session is valid, also consider making the cookie rolling by using setSession

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
  const sessionCookie = cookies[CookieName];

    // JWT bearer token takes precedence over cookie when both are present
  let tokenToVerify: string | undefined;
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    tokenToVerify = authHeader.substring(7).trim();
  }
  if (!tokenToVerify) {
    tokenToVerify = sessionCookie;
  }

  if (!tokenToVerify) {
    throw new NotAuthenticatedError();
  }
  try {
    const { payload } = await jwtVerify(tokenToVerify, encoder.encode(secret));
    return {
      id: payload.id as string,
      createdAt: payload.createdAt as number,
      lastAccessed: payload.lastAccessed as number,
      passwordChangeRequired: payload.passwordChangeRequired as boolean,
      impersonatorAdminId: payload.impersonatorAdminId as number | undefined,
    };
  } catch (error) {
    throw new NotAuthenticatedError();
  }
}

/**
 * Sign a session JWT. Defaults to the 90-day browser session lifetime; the teacher MCP connector
 * passes a short expiration because it mints a token per request rather than storing one.
 */
export async function createServerSessionToken(
  session: Session,
  expiration: string = "90d"
): Promise<string> {
  return new SignJWT({
    id: session.id,
    createdAt: session.createdAt,
    lastAccessed: session.lastAccessed,
    passwordChangeRequired: session.passwordChangeRequired,
    impersonatorAdminId: session.impersonatorAdminId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(encoder.encode(secret));
}

export async function setServerSession(
  response: Response,
  session: Session
): Promise<void> {
  const token = await createServerSessionToken(session);

  const cookieValue = [
    `${CookieName}=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Partitioned",
    "Path=/",
    `Max-Age=${SessionExpirationSeconds}`,
  ].join("; ");

  response.headers.set("Set-Cookie", cookieValue);
}

export function clearServerSession(response: Response) {
  // Clear the session cookie by setting an expired date
  const cookieValue = [
    `${CookieName}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Partitioned",
    "Path=/",
    "Max-Age=0", // Expire immediately
  ].join("; ");

  response.headers.set("Set-Cookie", cookieValue);
}
