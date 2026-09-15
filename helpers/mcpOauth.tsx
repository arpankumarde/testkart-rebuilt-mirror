/**
 * OAuth 2.1 authorization server behind the MCP connectors.
 *
 * Two connectors share it, each its own resource and issuer: the admin connector at
 * /_api/mcp/admin and the teacher connector at /_api/mcp/teacher. Codes and tokens record their
 * audience, so a token minted for one connector is refused by the other.
 *
 * Only what MCP clients need: dynamic client registration (RFC 7591), the authorization-code flow
 * with mandatory PKCE S256, and refresh tokens. No implicit flow and no client secrets - MCP
 * clients are public clients.
 *
 * Codes and tokens are stored only as SHA-256 hashes; the plaintext exists just long enough to be
 * handed to the client.
 *
 * Each teacher token pair is backed by its own row in `sessions`, so the teacher endpoints see an
 * ordinary signed-in session. Deleting that row - signing out everywhere, deleting the account -
 * revokes the connection.
 */

import { db } from "./db";
import { SITE_ORIGIN } from "./shareLinks";

const CODE_TTL_SECONDS = 60 * 5;
const ACCESS_TTL_SECONDS = 60 * 60;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

export type McpAudience = "admin" | "teacher";

export function mcpResourceUrl(audience: McpAudience): string {
  return `${SITE_ORIGIN}/_api/mcp/${audience}`;
}

export function mcpResourceMetadataUrl(audience: McpAudience): string {
  return `${SITE_ORIGIN}/.well-known/oauth-protected-resource/_api/mcp/${audience}`;
}

/** Who approved an authorization request. */
export type McpGrantor =
  | { audience: "admin"; adminId: number }
  | { audience: "teacher"; userId: number; impersonatorAdminId: number | null };

/** What a valid access token resolves to. */
export type McpAccess =
  | { audience: "admin"; adminId: number }
  | { audience: "teacher"; userId: number; sessionId: string };

export class OAuthError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "OAuthError";
    this.code = code;
    this.status = status;
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return base64Url(new Uint8Array(digest));
}

/** Length-checked comparison over fixed-length digests. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// --- Clients ---------------------------------------------------------------

export type RegisteredClient = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
};

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** WHATWG form of a URL, e.g. a bare origin gains its trailing slash. Null when unparseable. */
function normaliseUrl(uri: string): string | null {
  try {
    return new URL(uri).toString();
  } catch {
    return null;
  }
}

function normaliseRedirectUris(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new OAuthError("invalid_redirect_uri", "At least one redirect_uri is required.");
  }
  return value.map((uri) => {
    if (typeof uri !== "string") {
      throw new OAuthError("invalid_redirect_uri", "redirect_uri entries must be strings.");
    }
    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      throw new OAuthError("invalid_redirect_uri", `Not a valid URL: ${uri}`);
    }
    const isLoopback = LOOPBACK_HOSTS.has(parsed.hostname);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback)) {
      throw new OAuthError("invalid_redirect_uri", `redirect_uri must use https: ${uri}`);
    }
    if (parsed.hash) {
      throw new OAuthError("invalid_redirect_uri", "redirect_uri must not contain a fragment.");
    }
    return parsed.toString();
  });
}

export async function registerClient(input: {
  clientName?: unknown;
  redirectUris: unknown;
}): Promise<RegisteredClient> {
  const redirectUris = normaliseRedirectUris(input.redirectUris);
  const clientName =
    typeof input.clientName === "string" && input.clientName.trim()
      ? input.clientName.trim().slice(0, 200)
      : "MCP client";
  const clientId = randomToken(16);

  await db.insertInto("mcpOauthClients").values({ clientId, clientName, redirectUris }).execute();

  return { clientId, clientName, redirectUris };
}

export async function lookupClient(clientId: string): Promise<RegisteredClient | null> {
  const row = await db
    .selectFrom("mcpOauthClients")
    .selectAll()
    .where("clientId", "=", clientId)
    .executeTakeFirst();
  if (!row) return null;
  return {
    clientId: row.clientId,
    clientName: row.clientName,
    redirectUris: (row.redirectUris ?? []) as string[],
  };
}

// --- Authorization requests ------------------------------------------------

export type ParsedAuthRequest = {
  clientId: string;
  client: RegisteredClient;
  redirectUri: string;
  state: string | null;
  scope: string | null;
  resource: string | null;
  codeChallenge: string;
  codeChallengeMethod: string;
};

/**
 * Validate an /authorize query for one connector. Throws OAuthError for anything malformed - the
 * caller renders those rather than redirecting, since an unvalidated redirect_uri is not a safe
 * target.
 */
export async function parseAuthorizeParams(
  params: URLSearchParams,
  audience: McpAudience
): Promise<ParsedAuthRequest> {
  const clientId = params.get("client_id");
  if (!clientId) throw new OAuthError("invalid_request", "client_id is required.");

  const client = await lookupClient(clientId);
  if (!client) throw new OAuthError("invalid_client", "Unknown client_id.", 401);

  if (params.get("response_type") !== "code") {
    throw new OAuthError("unsupported_response_type", "Only response_type=code is supported.");
  }

  const redirectUri = params.get("redirect_uri");
  if (!redirectUri) throw new OAuthError("invalid_request", "redirect_uri is required.");
  // Registered URIs are stored normalised, so match either form: VS Code registers
  // http://127.0.0.1:33418 and sends it back without the trailing slash storage added.
  const normalisedRedirectUri = normaliseUrl(redirectUri);
  if (
    !client.redirectUris.includes(redirectUri) &&
    (normalisedRedirectUri === null || !client.redirectUris.includes(normalisedRedirectUri))
  ) {
    throw new OAuthError("invalid_request", "redirect_uri is not registered for this client.");
  }

  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method") ?? "plain";
  if (!codeChallenge) {
    throw new OAuthError("invalid_request", "PKCE is required: code_challenge is missing.");
  }
  if (codeChallengeMethod !== "S256") {
    throw new OAuthError("invalid_request", "code_challenge_method must be S256.");
  }

  const resource = params.get("resource");
  if (resource && resource.replace(/\/+$/, "") !== mcpResourceUrl(audience)) {
    throw new OAuthError(
      "invalid_target",
      `This authorization server only issues tokens for ${mcpResourceUrl(audience)}.`
    );
  }

  return {
    clientId,
    client,
    redirectUri,
    state: params.get("state"),
    scope: params.get("scope"),
    resource,
    codeChallenge,
    codeChallengeMethod,
  };
}

/** Issue an authorization code bound to this grantor, client and PKCE challenge. */
export async function issueAuthorizationCode(
  request: ParsedAuthRequest,
  grantor: McpGrantor
): Promise<string> {
  const code = randomToken(32);
  await db
    .insertInto("mcpOauthCodes")
    .values({
      codeHash: await sha256Base64Url(code),
      clientId: request.clientId,
      audience: grantor.audience,
      adminId: grantor.audience === "admin" ? grantor.adminId : null,
      userId: grantor.audience === "teacher" ? grantor.userId : null,
      impersonatorAdminId: grantor.audience === "teacher" ? grantor.impersonatorAdminId : null,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      codeChallengeMethod: request.codeChallengeMethod,
      scope: request.scope,
      resource: request.resource,
      expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000),
    })
    .execute();
  return code;
}

export function buildRedirect(request: ParsedAuthRequest, code: string): string {
  const target = new URL(request.redirectUri);
  target.searchParams.set("code", code);
  if (request.state) target.searchParams.set("state", request.state);
  return target.toString();
}

// --- Token issuance --------------------------------------------------------

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string | null;
};

async function issueTokenPair(input: {
  clientId: string;
  scope: string | null;
  grantor: McpGrantor;
}): Promise<IssuedTokens> {
  const { grantor } = input;
  const accessToken = randomToken(32);
  const refreshToken = randomToken(32);
  const now = Date.now();
  const refreshExpiresAt = new Date(now + REFRESH_TTL_SECONDS * 1000);

  let sessionId: string | null = null;
  if (grantor.audience === "teacher") {
    sessionId = randomToken(32);
    await db
      .insertInto("sessions")
      .values({
        id: sessionId,
        userId: grantor.userId,
        createdAt: new Date(now),
        lastAccessed: new Date(now),
        expiresAt: refreshExpiresAt,
        impersonatorAdminId: grantor.impersonatorAdminId,
      })
      .execute();
  }

  await db
    .insertInto("mcpOauthTokens")
    .values({
      accessTokenHash: await sha256Base64Url(accessToken),
      refreshTokenHash: await sha256Base64Url(refreshToken),
      clientId: input.clientId,
      audience: grantor.audience,
      adminId: grantor.audience === "admin" ? grantor.adminId : null,
      userId: grantor.audience === "teacher" ? grantor.userId : null,
      sessionId,
      scope: input.scope,
      accessExpiresAt: new Date(now + ACCESS_TTL_SECONDS * 1000),
      refreshExpiresAt,
    })
    .execute();

  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS, scope: input.scope };
}

/** Exchange an authorization code for tokens, verifying the PKCE verifier. */
export async function exchangeAuthorizationCode(
  input: {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier: string;
  },
  audience: McpAudience
): Promise<IssuedTokens> {
  const codeHash = await sha256Base64Url(input.code);

  // Consume first, so a replayed code cannot race a valid exchange.
  const consumed = await db
    .updateTable("mcpOauthCodes")
    .set({ consumedAt: new Date() })
    .where("codeHash", "=", codeHash)
    .where("consumedAt", "is", null)
    .returningAll()
    .executeTakeFirst();

  if (!consumed) {
    throw new OAuthError("invalid_grant", "Authorization code is invalid or has already been used.");
  }
  if (consumed.audience !== audience) {
    throw new OAuthError("invalid_grant", "Authorization code was issued for a different connector.");
  }
  if (new Date(consumed.expiresAt).getTime() < Date.now()) {
    throw new OAuthError("invalid_grant", "Authorization code has expired.");
  }
  if (consumed.clientId !== input.clientId) {
    throw new OAuthError("invalid_grant", "Authorization code was issued to a different client.");
  }
  if (consumed.redirectUri !== input.redirectUri) {
    throw new OAuthError("invalid_grant", "redirect_uri does not match the authorization request.");
  }

  const challenge = await sha256Base64Url(input.codeVerifier);
  if (!safeEqual(challenge, consumed.codeChallenge)) {
    throw new OAuthError("invalid_grant", "PKCE verification failed.");
  }

  let grantor: McpGrantor;
  if (consumed.audience === "teacher" && consumed.userId !== null) {
    grantor = {
      audience: "teacher",
      userId: consumed.userId,
      impersonatorAdminId: consumed.impersonatorAdminId,
    };
  } else if (consumed.audience === "admin" && consumed.adminId !== null) {
    grantor = { audience: "admin", adminId: consumed.adminId };
  } else {
    throw new OAuthError("invalid_grant", "Authorization code is malformed.");
  }

  return issueTokenPair({ clientId: consumed.clientId, scope: consumed.scope, grantor });
}

/**
 * Rotate a refresh token. The old row is revoked first, so a replayed refresh token fails, and a
 * teacher's old session row is replaced by a fresh one.
 */
export async function refreshAccessToken(
  input: {
    refreshToken: string;
    clientId: string;
  },
  audience: McpAudience
): Promise<IssuedTokens> {
  const refreshHash = await sha256Base64Url(input.refreshToken);
  const row = await db
    .selectFrom("mcpOauthTokens")
    .selectAll()
    .where("refreshTokenHash", "=", refreshHash)
    .executeTakeFirst();

  if (!row) throw new OAuthError("invalid_grant", "Refresh token is invalid.");
  if (row.audience !== audience) {
    throw new OAuthError("invalid_grant", "Refresh token was issued for a different connector.");
  }
  if (row.revokedAt) throw new OAuthError("invalid_grant", "Refresh token has been revoked.");
  if (row.clientId !== input.clientId) {
    throw new OAuthError("invalid_grant", "Refresh token was issued to a different client.");
  }
  if (row.refreshExpiresAt && new Date(row.refreshExpiresAt).getTime() < Date.now()) {
    throw new OAuthError("invalid_grant", "Refresh token has expired.");
  }

  let grantor: McpGrantor;
  if (row.audience === "teacher") {
    const session = row.sessionId
      ? await db
          .selectFrom("sessions")
          .select(["id", "impersonatorAdminId"])
          .where("id", "=", row.sessionId)
          .executeTakeFirst()
      : undefined;
    if (!session || row.userId === null) {
      throw new OAuthError(
        "invalid_grant",
        "The teacher session behind this connection has ended. Connect again."
      );
    }
    grantor = {
      audience: "teacher",
      userId: row.userId,
      impersonatorAdminId: session.impersonatorAdminId,
    };
  } else {
    if (row.adminId === null) throw new OAuthError("invalid_grant", "Refresh token is invalid.");
    grantor = { audience: "admin", adminId: row.adminId };
  }

  const revoked = await db
    .updateTable("mcpOauthTokens")
    .set({ revokedAt: new Date() })
    .where("id", "=", row.id)
    .where("revokedAt", "is", null)
    .returning("id")
    .executeTakeFirst();
  if (!revoked) throw new OAuthError("invalid_grant", "Refresh token has been revoked.");

  const tokens = await issueTokenPair({ clientId: row.clientId, scope: row.scope, grantor });
  if (row.sessionId) {
    await db.deleteFrom("sessions").where("id", "=", row.sessionId).execute();
  }
  return tokens;
}

/**
 * Resolve a Bearer access token for one connector.
 * Returns null for anything unknown, expired, revoked or minted for the other connector - callers
 * must answer 401.
 */
export async function resolveAccessToken(
  accessToken: string,
  audience: McpAudience
): Promise<McpAccess | null> {
  const hash = await sha256Base64Url(accessToken);
  const row = await db
    .selectFrom("mcpOauthTokens")
    .leftJoin("sessions", "sessions.id", "mcpOauthTokens.sessionId")
    .select([
      "mcpOauthTokens.audience",
      "mcpOauthTokens.adminId",
      "mcpOauthTokens.userId",
      "mcpOauthTokens.accessExpiresAt",
      "mcpOauthTokens.revokedAt",
      "sessions.id as liveSessionId",
    ])
    .where("mcpOauthTokens.accessTokenHash", "=", hash)
    .executeTakeFirst();

  if (!row || row.revokedAt || row.audience !== audience) return null;
  if (new Date(row.accessExpiresAt).getTime() < Date.now()) return null;

  let access: McpAccess;
  if (row.audience === "teacher") {
    if (row.userId === null || !row.liveSessionId) return null;
    access = { audience: "teacher", userId: row.userId, sessionId: row.liveSessionId };
  } else {
    if (row.adminId === null) return null;
    access = { audience: "admin", adminId: row.adminId };
  }

  await db
    .updateTable("mcpOauthTokens")
    .set({ lastUsedAt: new Date() })
    .where("accessTokenHash", "=", hash)
    .execute();

  return access;
}

export async function revokeToken(token: string): Promise<void> {
  const hash = await sha256Base64Url(token);
  await db
    .updateTable("mcpOauthTokens")
    .set({ revokedAt: new Date() })
    .where((eb) => eb.or([eb("accessTokenHash", "=", hash), eb("refreshTokenHash", "=", hash)]))
    .where("revokedAt", "is", null)
    .execute();
}
