import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { maskEmail, maskPhone, parseContactEmails } from "../../../../helpers/organizationClaim";
import { schema, OutputType, ClaimContactOption } from "./options_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teacher accounts can claim an organisation." }), {
        status: 403,
      });
    }

    const url = new URL(request.url);
    const input = schema.parse({ organizationId: url.searchParams.get("organizationId") });

    const org = await db
      .selectFrom("organizations")
      .select(["id", "name", "claimStatus", "phoneNumber", "contactEmails"])
      .where("id", "=", input.organizationId)
      .executeTakeFirst();

    if (!org) {
      return new Response(superjson.stringify({ error: "Organisation not found." }), { status: 404 });
    }

    const options: ClaimContactOption[] = [];
    if (org.phoneNumber) {
      options.push({ method: "phone", value: org.phoneNumber, masked: maskPhone(org.phoneNumber) });
    }
    for (const email of parseContactEmails(org.contactEmails)) {
      options.push({ method: "email", value: email, masked: maskEmail(email) });
    }

    const canClaim = org.claimStatus !== "claimed" && options.length > 0;

    return new Response(
      superjson.stringify({
        organizationName: org.name,
        claimStatus: org.claimStatus,
        canClaim,
        options,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to load claim options:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
