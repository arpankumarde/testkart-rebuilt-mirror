/**
 * Request handlers behind the MCP OAuth endpoints. Each connector has its own endpoint files under
 * /_api/mcp/<audience>/ - authorize, token and register - and they delegate here with their
 * audience.
 */

import { getAdminServerSessionOrThrow } from "./getAdminSession";
import { getServerUserSession } from "./getServerUserSession";
import {
  renderConsentPage,
  renderOAuthError,
  renderSessionCheck,
  renderSignInRequired,
} from "./mcpConsentPage";
import {
  buildRedirect,
  exchangeAuthorizationCode,
  IssuedTokens,
  issueAuthorizationCode,
  McpAudience,
  McpGrantor,
  OAuthError,
  parseAuthorizeParams,
  refreshAccessToken,
  registerClient,
} from "./mcpOauth";
import { RegisterResponse, registerRequestSchema, TokenResponse, tokenRequestSchema } from "./mcpSchemas";

const OAUTH_FIELDS = [
  "client_id",
  "redirect_uri",
  "state",
  "response_type",
  "scope",
  "code_challenge",
  "code_challenge_method",
  "resource",
] as const;

/** Marks the same-site reload of a teacher authorize request, so a signed-out user cannot loop. */
const SESSION_CHECK_PARAM = "session_check";

const ROLE_PHRASE: Record<string, string> = {
  admin: "an admin",
  student: "a student",
  teacher: "a teacher",
};

type Signer = {
  grantor: McpGrantor;
  name: string;
  detail: string;
  notice: string | null;
};

async function resolveSigner(
  request: Request,
  audience: McpAudience
): Promise<Signer | "signed_out" | { error: string }> {
  if (audience === "admin") {
    try {
      const admin = await getAdminServerSessionOrThrow(request);
      return {
        grantor: { audience: "admin", adminId: admin.id },
        name: admin.fullName,
        detail: admin.email,
        notice: null,
      };
    } catch {
      return "signed_out";
    }
  }

  let session: Awaited<ReturnType<typeof getServerUserSession>>;
  try {
    session = await getServerUserSession(request);
  } catch {
    return "signed_out";
  }

  if (session.user.role !== "teacher") {
    return {
      error:
        `This connector is for teacher accounts, and you are signed in as ` +
        `${ROLE_PHRASE[session.user.role] ?? session.user.role}. Sign in with your teacher account and try again.`,
    };
  }

  const notices: string[] = [];
  if (session.impersonatorAdminId != null) {
    notices.push(
      "You are impersonating this teacher as an admin. The connector will act as this teacher until it is removed."
    );
  }
  if (session.teacherRole === "manager") {
    notices.push("You are a team manager, so the connector will work on your team owner's account.");
  }

  return {
    grantor: {
      audience: "teacher",
      userId: session.user.id,
      impersonatorAdminId: session.impersonatorAdminId ?? null,
    },
    name: session.user.displayName,
    detail: session.user.email ?? session.user.mobileNumber ?? `User ${session.user.id}`,
    notice: notices.length > 0 ? notices.join(" ") : null,
  };
}

function redirectTo(location: string): Response {
  // A body is required here; an empty one makes CloudFront hang.
  return new Response("Redirecting...", { status: 302, headers: { Location: location } });
}

export async function handleAuthorizeGet(request: Request, audience: McpAudience): Promise<Response> {
  const url = new URL(request.url);

  let authRequest;
  try {
    authRequest = await parseAuthorizeParams(url.searchParams, audience);
  } catch (error) {
    // The redirect_uri is not trustworthy until it has been validated, so render the error
    // rather than bouncing the browser to an attacker-supplied target.
    if (error instanceof OAuthError) return renderOAuthError(audience, error.message);
    throw error;
  }

  const signer = await resolveSigner(request, audience);

  if (signer === "signed_out") {
    if (audience === "teacher" && !url.searchParams.has(SESSION_CHECK_PARAM)) {
      const retry = new URL(url.toString());
      retry.searchParams.set(SESSION_CHECK_PARAM, "1");
      return renderSessionCheck(audience, `${retry.pathname}${retry.search}`);
    }
    return renderSignInRequired(audience, `${url.pathname}${url.search}`);
  }
  if ("error" in signer) return renderOAuthError(audience, signer.error, "Wrong account", 403);

  return renderConsentPage({
    audience,
    params: url.searchParams,
    clientName: authRequest.client.clientName,
    accountName: signer.name,
    accountDetail: signer.detail,
    notice: signer.notice,
  });
}

/** Consent submission. Requires the session again - consent alone is not authentication. */
export async function handleAuthorizePost(request: Request, audience: McpAudience): Promise<Response> {
  const form = await request.formData();

  const params = new URLSearchParams();
  for (const field of OAUTH_FIELDS) {
    const value = form.get(field);
    if (typeof value === "string" && value !== "") params.set(field, value);
  }

  let authRequest;
  try {
    // Re-validate from the submitted fields rather than trusting them.
    authRequest = await parseAuthorizeParams(params, audience);
  } catch (error) {
    if (error instanceof OAuthError) return renderOAuthError(audience, error.message);
    throw error;
  }

  const signer = await resolveSigner(request, audience);
  if (signer === "signed_out") {
    return renderSignInRequired(audience, `/_api/mcp/${audience}/authorize?${params.toString()}`);
  }
  if ("error" in signer) return renderOAuthError(audience, signer.error, "Wrong account", 403);

  if (form.get("action") !== "allow") {
    const denied = new URL(authRequest.redirectUri);
    denied.searchParams.set("error", "access_denied");
    denied.searchParams.set("error_description", "The user declined the request.");
    if (authRequest.state) denied.searchParams.set("state", authRequest.state);
    return redirectTo(denied.toString());
  }

  const code = await issueAuthorizationCode(authRequest, signer.grantor);
  return redirectTo(buildRedirect(authRequest, code));
}

const TOKEN_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  Pragma: "no-cache",
};

function tokenResponse(tokens: IssuedTokens): Response {
  return new Response(
    JSON.stringify({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      ...(tokens.scope ? { scope: tokens.scope } : {}),
    } satisfies TokenResponse),
    { headers: TOKEN_HEADERS }
  );
}

function tokenFailure(code: string, description: string, status = 400): Response {
  return new Response(JSON.stringify({ error: code, error_description: description }), {
    status,
    headers: TOKEN_HEADERS,
  });
}

/** Public clients only - no client secret is accepted or required, PKCE carries the proof. */
export async function handleToken(request: Request, audience: McpAudience): Promise<Response> {
  try {
    const form = await request.formData();
    const raw: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") raw[key] = value;
    }

    const parsed = tokenRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return tokenFailure("invalid_request", parsed.error.issues[0]?.message ?? "Malformed token request.");
    }
    const input = parsed.data;

    if (input.grant_type === "authorization_code") {
      return tokenResponse(
        await exchangeAuthorizationCode(
          {
            code: input.code,
            clientId: input.client_id,
            redirectUri: input.redirect_uri,
            codeVerifier: input.code_verifier,
          },
          audience
        )
      );
    }

    return tokenResponse(
      await refreshAccessToken({ refreshToken: input.refresh_token, clientId: input.client_id }, audience)
    );
  } catch (error) {
    if (error instanceof OAuthError) return tokenFailure(error.code, error.message, error.status);
    console.error(`MCP ${audience} token endpoint error:`, error);
    return tokenFailure("server_error", "Token request failed.", 500);
  }
}

const REGISTER_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

export async function handleRegister(request: Request): Promise<Response> {
  try {
    // RFC 7591 clients send plain JSON, not the superjson envelope used elsewhere in this API.
    const input = registerRequestSchema.parse(JSON.parse(await request.text()));

    const client = await registerClient({
      clientName: input.client_name,
      redirectUris: input.redirect_uris,
    });

    return new Response(
      JSON.stringify({
        client_id: client.clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      } satisfies RegisterResponse),
      { status: 201, headers: REGISTER_HEADERS }
    );
  } catch (error) {
    if (error instanceof OAuthError) {
      return new Response(JSON.stringify({ error: error.code, error_description: error.message }), {
        status: error.status,
        headers: REGISTER_HEADERS,
      });
    }
    const message = error instanceof Error ? error.message : "Registration failed";
    return new Response(JSON.stringify({ error: "invalid_client_metadata", error_description: message }), {
      status: 400,
      headers: REGISTER_HEADERS,
    });
  }
}
