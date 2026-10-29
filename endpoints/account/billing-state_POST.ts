import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./billing-state_POST.schema";
import { BillingDetails } from "./billing-details_GET.schema";
import { readStoredBillingDetails } from "../../helpers/billingDetailsStore";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { ZodError } from "zod";

/**
 * Saves only the billing state (country is always India), keeping every other
 * saved billing field. Used by the dashboard popup that asks for the state.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "student" && user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const validatedInput = schema.parse(superjson.parse(await request.text()));
    const targetUserId = user.role === "teacher" ? effectiveTeacherId : user.id;
    const existing = await readStoredBillingDetails(targetUserId);

    const billingDetails: BillingDetails = {
      name: existing?.name ?? "",
      email: existing?.email ?? "",
      phone: existing?.phone ?? "",
      address: existing?.address ?? "",
      state: validatedInput.state,
      country: "India",
      gstin: existing?.gstin ?? null,
    };

    await db
      .updateTable("users")
      .set({ billingDetails, updatedAt: new Date() })
      .where("id", "=", targetUserId)
      .execute();

    const output: OutputType = { billingDetails };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error saving billing state:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: error.errors[0]?.message || "Invalid input" }), {
        status: 400,
      });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}