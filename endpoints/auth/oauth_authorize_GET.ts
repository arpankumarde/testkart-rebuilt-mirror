import { db } from "../../helpers/db";
import crypto from "crypto";
import { getOAuthRedirectUri } from "../../helpers/getOAuthRedirectUri";
import { getOAuthProvider } from "../../helpers/getOAuthProvider";
import { schema } from "./oauth_authorize_GET.schema";
import { validateRedirectPath } from "../../helpers/validateRedirectPath";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { setServerSession } from "../../helpers/getSetServerSession";
import { isAppDeepLink } from "../../helpers/isAppDeepLink";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider");
    const role = url.searchParams.get("role");
    const redirectTo = url.searchParams.get("redirectTo") ?? undefined;
    const linkAccount = url.searchParams.get("link_account") ?? undefined;

    // Validate provider, role, redirectTo, and link_account using schema
    let validatedProvider;
    let validatedRole;
    let validatedRedirectTo;
    let validatedLinkAccount;
    try {
      const validated = schema.parse({ provider, role, redirectTo, link_account: linkAccount });
      validatedProvider = validated.provider;
      validatedRole = validated.role;
      validatedRedirectTo = validated.redirectTo;
      validatedLinkAccount = validated.link_account;
    } catch (validationError) {
      console.error("Validation error:", validationError);
      return Response.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      );
    }

    // If link_account is true, get the current user session
    let currentUserId: number | null = null;
    let sessionToExtend: any = null;
    if (validatedLinkAccount === 'true') {
      try {
        const { user, session } = await getServerUserSession(request);
        currentUserId = user.id;
        sessionToExtend = session;
      } catch (error) {
        // User not authenticated - cannot link account
        return Response.json(
          { error: "You must be logged in to link an account" },
          { status: 401 }
        );
      }
    }

    // Determine redirect path: deep links are stored as-is, normal paths are validated
    let safeRedirectPath: string | null = null;
    let isMobileFlow = false;
    if (validatedRedirectTo) {
      if (isAppDeepLink(validatedRedirectTo)) {
        safeRedirectPath = validatedRedirectTo;
        isMobileFlow = true;
      } else {
        safeRedirectPath = validateRedirectPath(validatedRedirectTo);
      }
    }

    // Get provider instance using the helper
    let oauthProvider;
    try {
      const redirectUri = getOAuthRedirectUri(request.url);
      oauthProvider = getOAuthProvider(validatedProvider, redirectUri);
    } catch (configError) {
      console.error("Provider configuration error:", configError);
      if (configError instanceof Error) {
        return Response.json({ error: configError.message }, { status: 400 });
      }
      return Response.json(
        { error: "Invalid provider configuration" },
        { status: 400 }
      );
    }

    const state = crypto.randomBytes(32).toString("hex");

    const { url: authUrl, codeVerifier } =
      oauthProvider.generateAuthorizationUrl(state);

    // Clean up expired OAuth states before creating new ones to prevent database bloat
    try {
      await db
        .deleteFrom("oauthStates")
        .where("expiresAt", "<", new Date())
        .execute();
    } catch {
      // Fail silently if cleanup fails
    }

    // Store state in database with exact redirect URI and provider info (10 minutes expiration)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
      const now = new Date();
      
      await db
        .insertInto("oauthStates")
        .values({
          state,
          provider: validatedProvider,
          redirectUrl: oauthProvider.redirectUri,
          codeVerifier: codeVerifier || "", // Provide empty string if no code_verifier
          requestedRole: validatedRole,
          redirectToPath: safeRedirectPath,
          userId: currentUserId,
          expiresAt,
          createdAt: now,
        })
        .execute();
    } catch (dbError) {
      console.error("Failed to store OAuth state:", dbError);
      return Response.json(
        { error: "Failed to initialize OAuth flow" },
        { status: 500 }
      );
    }

    // Mobile deep link flow: return JSON with the auth URL instead of redirecting
    if (isMobileFlow) {
      console.log("Mobile OAuth flow detected, returning JSON with auth URL");
      return Response.json({ redirectUrl: authUrl }, { status: 200 });
    }

    // Set secure state cookie as additional CSRF protection
    const cookieValue = [
      `oauth_state=${state}`,
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
      "Path=/",
      `Max-Age=600`, // 10 minutes
    ].join("; ");
    // Create response with redirect and secure state cookie
    // The response should be non-empty because Floot backend runs on streaming lambda and will hang otherwise.
    const response = new Response("Redirecting...", {
      status: 302,
      headers: {
        Location: authUrl,
        "Cache-Control": "no-store",
        "Set-Cookie": cookieValue,
      },
    });

    // Update the session cookie to keep it alive if we have a session to extend
    if (sessionToExtend) {
      await setServerSession(response, sessionToExtend);
    }

    return response;
  } catch (error) {
    console.error("Error in OAuth authorization:", error);

    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}