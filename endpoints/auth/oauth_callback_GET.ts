import { db } from "../../helpers/db";
import {
  createOAuthPopupResponseHtml,
  type OAuthTokenSuccessMessage,
  type OAuthErrorMessage,
} from "../../helpers/oauthPopupMessage";
import {
  OAuthProviderInterface,
  type OAuthProviderType,
  oauthProviders,
} from "../../helpers/OAuthProvider";
import { getOAuthProvider } from "../../helpers/getOAuthProvider";
import { schema } from "./oauth_callback_GET.schema";
import crypto from "crypto";
import { ZodError } from "zod";
import { handleOAuthUserAccount } from "../../helpers/handleOAuthUserAccount";
import { sendOAuthWelcomeEmail } from "../../helpers/sendOAuthWelcomeEmail";
import { addTeacherToSalesContacts } from "../../helpers/addTeacherToSalesContacts";
import { SignJWT } from "jose";
import { SessionExpirationSeconds } from "../../helpers/getSetServerSession";
import { validateRedirectPath } from "../../helpers/validateRedirectPath";
import { isAppDeepLink } from "../../helpers/isAppDeepLink";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // Parse and validate query parameters with specific Zod error handling
    let result;
    try {
      result = schema.parse(queryParams);
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        const errorMessage: OAuthErrorMessage = {
          type: "OAUTH_ERROR",
          provider: "unknown" as any,
          error: {
            message: "Invalid request parameters",
            code: "validation_error",
            details: validationError.errors
              .map((err) => err.message)
              .join(", "),
          },
        };
        return new Response(createOAuthPopupResponseHtml(errorMessage), {
          status: 400,
          headers: { "Content-Type": "text/html" },
        });
      }
      // Re-throw non-Zod errors to be handled by the outer catch block
      throw validationError;
    }

    const { code, state, error } = result;

    // Verify state parameter and retrieve stored information first
    const oauthStateResults = await db
      .selectFrom("oauthStates")
      .select([
        "id",
        "redirectUrl",
        "expiresAt",
        "codeVerifier",
        "provider",
        "requestedRole",
        "redirectToPath",
        "userId",
      ])
      .where("state", "=", state)
      .limit(1)
      .execute();

    if (oauthStateResults.length === 0) {
      console.error("Invalid OAuth state - not found in database");
      const errorMessage: OAuthErrorMessage = {
        type: "OAUTH_ERROR",
        provider: "unknown" as any,
        error: {
          message: "Invalid OAuth state",
          code: "invalid_state",
        },
      };
      return new Response(createOAuthPopupResponseHtml(errorMessage), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    const oauthState = oauthStateResults[0];

    // Get userId directly from the database
    const linkUserId: number | null = oauthState.userId;
    const storedRedirectPath: string | null = oauthState.redirectToPath;
    const actualRedirectPath: string | null =
      storedRedirectPath !== null && isAppDeepLink(storedRedirectPath)
        ? storedRedirectPath
        : validateRedirectPath(storedRedirectPath);

    // Validate that the provider from the database is a supported provider
    if (!oauthProviders.includes(oauthState.provider as OAuthProviderType)) {
      console.error(
        "Unsupported OAuth provider from database:",
        oauthState.provider
      );
      const errorMessage: OAuthErrorMessage = {
        type: "OAUTH_ERROR",
        provider: "unknown" as any,
        error: {
          message: "Unsupported OAuth provider",
          code: "unsupported_provider",
          details: `Provider '${oauthState.provider}' is not supported`,
        },
      };
      return new Response(createOAuthPopupResponseHtml(errorMessage), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Cast to OAuthProviderType after validation
    const providerName = oauthState.provider as OAuthProviderType;

    // Handle OAuth error responses
    if (error) {
      console.error("OAuth error received:", error);
      const errorMessage: OAuthErrorMessage = {
        type: "OAUTH_ERROR",
        provider: providerName,
        error: {
          message: "OAuth authentication failed",
          code: "oauth_error",
          details: error,
        },
      };
      return new Response(createOAuthPopupResponseHtml(errorMessage), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    // When no error is present, code is required
    if (!code) {
      console.error("Missing required code parameter");
      const errorMessage: OAuthErrorMessage = {
        type: "OAUTH_ERROR",
        provider: providerName,
        error: {
          message: "Missing required OAuth authorization code",
          code: "missing_code",
        },
      };
      return new Response(createOAuthPopupResponseHtml(errorMessage), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Check if state has expired
    const now = new Date();
    if (oauthState.expiresAt < now) {
      console.error("OAuth state has expired");
      // Clean up expired state
      await db
        .deleteFrom("oauthStates")
        .where("id", "=", oauthState.id)
        .execute();
      const errorMessage: OAuthErrorMessage = {
        type: "OAUTH_ERROR",
        provider: providerName,
        error: {
          message: "OAuth state has expired",
          code: "state_expired",
        },
      };
      return new Response(createOAuthPopupResponseHtml(errorMessage), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Validate that redirect URI is stored
    if (!oauthState.redirectUrl) {
      console.error("Missing redirect URL in stored OAuth state");
      const errorMessage: OAuthErrorMessage = {
        type: "OAUTH_ERROR",
        provider: providerName,
        error: {
          message: "Invalid OAuth state - missing redirect URL",
          code: "invalid_state_redirect",
        },
      };
      return new Response(createOAuthPopupResponseHtml(errorMessage), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Create provider instance using the helper
    let oauthProvider: OAuthProviderInterface;
    try {
      oauthProvider = getOAuthProvider(providerName, oauthState.redirectUrl);
    } catch (providerError) {
      console.error("Failed to create OAuth provider:", providerError);
      const errorMessage: OAuthErrorMessage = {
        type: "OAUTH_ERROR",
        provider: oauthState.provider,
        error: {
          message: "OAuth provider configuration error",
          code: "provider_config_error",
          details:
            providerError instanceof Error
              ? providerError.message
              : "Unknown provider configuration error",
        },
      };
      return new Response(createOAuthPopupResponseHtml(errorMessage), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Exchange authorization code for access token using stored redirect URI
    let tokens;
    try {
      // All providers now handle PKCE internally - always pass the code_verifier
      tokens = await oauthProvider.exchangeCodeForTokens(
        code,
        oauthState.redirectUrl,
        oauthState.codeVerifier
      );
    } catch (tokenError) {
      console.error("Failed to exchange authorization code:", tokenError);

      if (tokenError instanceof Error) {
        console.error("Token exchange error details:", {
          name: tokenError.name,
          message: tokenError.message,
          stack: tokenError.stack?.substring(0, 500) + "...",
        });
      }

      const errorMessage: OAuthErrorMessage = {
        type: "OAUTH_ERROR",
        provider: oauthState.provider,
        error: {
          message: "Failed to exchange authorization code for access token",
          code: "token_exchange_failed",
          details:
            tokenError instanceof Error
              ? tokenError.message
              : "Unknown error occurred during token exchange",
        },
      };
      return new Response(createOAuthPopupResponseHtml(errorMessage), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (!tokens.accessToken) {
      console.error("No access token received from provider");
      console.error("Token response was:", tokens);
      const errorMessage: OAuthErrorMessage = {
        type: "OAUTH_ERROR",
        provider: oauthState.provider,
        error: {
          message: "No access token received from OAuth provider",
          code: "no_access_token",
        },
      };
      return new Response(createOAuthPopupResponseHtml(errorMessage), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Fetch user information from provider
    let userInfo;
    try {
      userInfo = await oauthProvider.fetchUserInfo(tokens);
    } catch (userInfoError) {
      console.error("Failed to fetch user information:", userInfoError);

      if (userInfoError instanceof Error) {
        console.error("User info fetch error details:", {
          name: userInfoError.name,
          message: userInfoError.message,
        });
      }

      const errorMessage: OAuthErrorMessage = {
        type: "OAUTH_ERROR",
        provider: oauthState.provider,
        error: {
          message: "Failed to fetch user information from OAuth provider",
          code: "user_info_failed",
          details:
            userInfoError instanceof Error
              ? userInfoError.message
              : "Unknown error occurred while fetching user info",
        },
      };
      return new Response(createOAuthPopupResponseHtml(errorMessage), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Map provider-specific user data to our format
    let mappedUserData;
    try {
      mappedUserData = oauthProvider.mapUserData(userInfo);
    } catch (mappingError) {
      console.error("Failed to map user data:", mappingError);
      const errorMessage: OAuthErrorMessage = {
        type: "OAUTH_ERROR",
        provider: oauthState.provider,
        error: {
          message: "Failed to process user information",
          code: "user_data_mapping_failed",
          details:
            mappingError instanceof Error
              ? mappingError.message
              : "Unknown error occurred while processing user data",
        },
      };
      return new Response(createOAuthPopupResponseHtml(errorMessage), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (!mappedUserData.email || !mappedUserData.displayName) {
      console.error("Missing required user information from provider");
      console.error("Mapped user data:", mappedUserData);
      const errorMessage: OAuthErrorMessage = {
        type: "OAUTH_ERROR",
        provider: oauthState.provider,
        error: {
          message: "Incomplete user information received from OAuth provider",
          code: "incomplete_user_info",
        },
      };
      return new Response(createOAuthPopupResponseHtml(errorMessage), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    const providerEmail = mappedUserData.email!; // Non-null assertion safe here because of the check above

    // Handle user account creation/linking/login logic using the extracted helper
    let user: {
      id: number;
      email: string | null;
      displayName: string;
      role: string;
    };
    let isNewUser = false;

    try {
      const accountResult = await handleOAuthUserAccount({
        providerName,
        providerEmail,
        mappedUserData,
        requestedRole: oauthState.requestedRole,
        linkUserId,
        now,
      });
      user = accountResult.user;
      isNewUser = accountResult.isNewUser;
    } catch (accountError) {
      console.error("Failed to handle OAuth user account:", accountError);

      // Clean up OAuth state since we're discarding this attempt
      await db
        .deleteFrom("oauthStates")
        .where("id", "=", oauthState.id)
        .execute();

      const errorMessage: OAuthErrorMessage = {
        type: "OAUTH_ERROR",
        provider: oauthState.provider as OAuthProviderType,
        error: {
          message:
            accountError instanceof Error
              ? accountError.message
              : "Failed to process user account",
          code: "account_handling_failed",
          details:
            accountError instanceof Error ? providerEmail : undefined,
        },
      };
      return new Response(createOAuthPopupResponseHtml(errorMessage), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Send welcome email and sync to Resend for new users (non-blocking)
    if (isNewUser) {
      sendOAuthWelcomeEmail({
        userDisplayName: user.displayName,
        userEmail: providerEmail,
        userId: user.id,
        role: oauthState.requestedRole as "student" | "teacher",
      });

      if (user.role === "teacher") {
        addTeacherToSalesContacts(user.id);
      }
    }

    // Determine if this is a mobile deep link redirect flow
    const isMobileDeepLink =
      actualRedirectPath !== null && isAppDeepLink(actualRedirectPath);

    if (isMobileDeepLink) {
      console.log(
        "Mobile deep link OAuth flow detected, redirectTo:",
        actualRedirectPath
      );

      // Create a long-lived session (30 days)
      const sessionId = crypto.randomUUID();
      const sessionExpiresAt = new Date(
        now.getTime() + SessionExpirationSeconds * 1000
      );

      await db
        .insertInto("sessions")
        .values({
          id: sessionId,
          userId: user.id,
          expiresAt: sessionExpiresAt,
          createdAt: now,
          lastAccessed: now,
          redirectToPath: null,
        })
        .execute();

      // Clean up the OAuth state
      await db
        .deleteFrom("oauthStates")
        .where("id", "=", oauthState.id)
        .execute();

      // Generate a JWT Bearer token for the session (same pattern as auth/api-token_POST)
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET environment variable is not set");
      }

      const encoder = new TextEncoder();
      const jwtToken = await new SignJWT({
        id: sessionId,
        createdAt: now.getTime(),
        lastAccessed: now.getTime(),
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(encoder.encode(jwtSecret));

      // Build the deep link redirect URL with the token as a query parameter
      const deepLinkUrl = new URL(actualRedirectPath);
      deepLinkUrl.searchParams.set("token", jwtToken);

      console.log(
        `Mobile OAuth redirect for user ${user.id} to deep link: ${actualRedirectPath}`
      );

      return new Response("Redirecting...", {
        status: 302,
        headers: {
          Location: deepLinkUrl.toString(),
        },
      });
    }

    // Normal popup flow: create temporary token that can be exchanged for a session
    const tempToken = crypto.randomUUID();
    const tempTokenExpiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    await db
      .insertInto("sessions")
      .values({
        id: tempToken,
        userId: user.id,
        expiresAt: tempTokenExpiresAt,
        createdAt: now,
        lastAccessed: now,
        redirectToPath: actualRedirectPath,
      })
      .execute();

    await db
      .deleteFrom("oauthStates")
      .where("id", "=", oauthState.id)
      .execute();

    // Create response with temporary token and optional redirectTo path
    const successMessage: OAuthTokenSuccessMessage = {
      type: "OAUTH_TOKEN_SUCCESS",
      provider: oauthState.provider as any,
      token: tempToken,
      redirectTo: actualRedirectPath || undefined,
    };

    const response = new Response(
      createOAuthPopupResponseHtml(successMessage),
      {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }
    );

    return response;
  } catch (error) {
    console.error("Error in generic OAuth callback:", error);

    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 1000) + "...",
      });
    }

    const errorMessage: OAuthErrorMessage = {
      type: "OAUTH_ERROR",
      provider: "unknown" as any,
      error: {
        message: "Internal server error during OAuth authentication",
        code: "internal_error",
        details:
          error instanceof Error
            ? error.message
            : "Unknown internal error occurred",
      },
    };

    return new Response(createOAuthPopupResponseHtml(errorMessage), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
}