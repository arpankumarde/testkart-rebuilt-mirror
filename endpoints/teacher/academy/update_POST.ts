import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./update_POST.schema";
import { generateUniqueSlug } from "../../../helpers/generateUniqueSlug";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { ZodError } from "zod";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // Block managers from owner-only features
    if (teacherRole === 'manager') {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    // For now, we only update the displayName with the academyName.
    // The other fields (description, website) are validated but not stored.
    // Also regenerate the slug based on the new academy name.
    const slug = await generateUniqueSlug(validatedInput.academyName);
    console.log(`Regenerating slug for teacher ${user.id} to: ${slug}`);

    const [updatedUser] = await db
      .updateTable("users")
      .set({
        displayName: validatedInput.academyName,
        slug,
        updatedAt: new Date(),
      })
      .where("id", "=", effectiveTeacherId)
      .returning("id")
      .execute();

    if (!updatedUser) {
      return new Response(
        superjson.stringify({ error: "User not found" }),
        { status: 404 }
      );
    }

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error updating teacher academy info:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: error.errors }), {
        status: 400,
      });
    }
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}