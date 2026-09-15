import { SignJWT } from "jose";
import superjson from "superjson";
import { schema, OutputType } from "./api-token_POST.schema";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    // Parse but ignore body since schema is empty, just ensures validity
    const json = superjson.parse(await request.text());
    schema.parse(json);

    // Get current authenticated user session
    const { session } = await getServerUserSession(request);

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
      impersonatorAdminId: session.impersonatorAdminId,
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
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    const status = error instanceof NotAuthenticatedError ? 401 : 400;
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    
    return new Response(
      superjson.stringify({ error: message }),
      { 
        status,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}