import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./billing-details_POST.schema";
import { BillingDetails } from "./billing-details_GET.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { ZodError } from "zod";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "student" && user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), {
        status: 403,
      });
    }

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    const targetUserId = user.role === "teacher" ? effectiveTeacherId : user.id;

    const billingDetails: BillingDetails = {
      name: validatedInput.name,
      email: validatedInput.email || "",
      phone: validatedInput.phone || "",
      address: validatedInput.address,
      gstin: validatedInput.gstin ? validatedInput.gstin.toUpperCase() : null,
    };

    await db
      .updateTable("users")
      .set({ billingDetails, updatedAt: new Date() })
      .where("id", "=", targetUserId)
      .execute();

    const output: OutputType = { billingDetails };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error updating billing details:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: error.errors[0]?.message || "Invalid input" }), {
        status: 400,
      });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}
