import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./update_POST.schema";
import { sanitizeOptionalHtml } from "../../../helpers/sanitizeHtml";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teachers can edit an organisation page." }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const org = await db
      .selectFrom("organizations")
      .select(["id", "createdByTeacherId"])
      .where("id", "=", input.organizationId)
      .executeTakeFirst();

    if (!org) {
      return new Response(superjson.stringify({ error: "Organisation not found." }), { status: 404 });
    }

    if (org.createdByTeacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "Only the organisation's creator can edit its page." }),
        { status: 403 }
      );
    }

    await db
      .updateTable("organizations")
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.orgType !== undefined && { orgType: input.orgType }),
        ...(input.description !== undefined && { description: sanitizeOptionalHtml(input.description) }),
        ...(input.location !== undefined && { location: input.location }),
        ...(input.websiteUrl !== undefined && { websiteUrl: input.websiteUrl }),
        ...(input.phoneNumber !== undefined && { phoneNumber: input.phoneNumber }),
        ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
        ...(input.logoFileId !== undefined && { logoFileId: input.logoFileId }),
        ...(input.coverImageUrl !== undefined && { coverImageUrl: input.coverImageUrl }),
        ...(input.coverImageFileId !== undefined && { coverImageFileId: input.coverImageFileId }),
        ...(input.foundedYear !== undefined && { foundedYear: input.foundedYear }),
        ...(input.instituteSize !== undefined && { instituteSize: input.instituteSize }),
        ...(input.specialties !== undefined && { specialties: JSON.stringify(input.specialties) }),
        ...(input.socialLinks !== undefined && { socialLinks: JSON.stringify(input.socialLinks) }),
        updatedAt: new Date(),
      })
      .where("id", "=", input.organizationId)
      .execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("Failed to update organization:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to update organisation.", details: errorMessage }),
      { status: 500 }
    );
  }
}
