import { SignJWT } from "jose";
import superjson from "superjson";
import { schema, OutputType } from "./api-token_POST.schema";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function handle(request: Request) {
  try {
    // Parse but ignore body since schema is empty, just ensures validity
    const json = superjson.parse(await request.text());
    schema.parse(json);

    // A 30-day bearer token outlives the session and works from anywhere, so it
    // is never issued to script running in a web page, where injected content
    // could request one. Browsers attach these headers to every fetch and page
    // script cannot remove them.
    if (
      request.headers.get("origin") ||
      request.headers.get("sec-fetch-mode") ||
      request.headers.get("sec-fetch-site")
    ) {
      return new Response(
        superjson.stringify({ error: "API tokens can't be created from a browser." }),
        { status: 403, headers: JSON_HEADERS }
      );
    }

    // Get current authenticated user session
    const { session } = await getServerUserSession(request);

    if (session.impersonatorAdminId) {
      return new Response(
        superjson.stringify({ error: "API tokens can't be created while impersonating a user." }),
        { status: 403, headers: JSON_HEADERS }
      );
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is not set");
    }

    const encoder = new TextEncoder();
    
    // Generate a new long-lived token containing the session mapping
    const token = await new SignJWT({
      id: session.id,
      createdAt: session.createdAt,
      lastAccessed: session.lastAccessed,
      passwordChangeRequired: session.passwordChangeRequired,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d") // 30 days expiry
      .sign(encoder.encode(secret));

    return new Response(
      superjson.stringify({
        token,
        expiresIn: "30 days",
      } satisfies OutputType),
      {
        status: 200,
        headers: JSON_HEADERS,
      }
    );
  } catch (error) {
    const status = error instanceof NotAuthenticatedError ? 401 : 400;
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    
    return new Response(
      superjson.stringify({ error: message }),
      { 
        status,
        headers: JSON_HEADERS,
      }
    );
  }
}
