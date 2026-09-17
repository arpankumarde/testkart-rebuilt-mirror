import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { ZodError } from "zod";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    // This writes the academy owner's public profile.
    if (teacherRole === "manager") {
      return new Response(
        superjson.stringify({ error: "Only the account owner can edit the public profile." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    if (Object.keys(validatedInput).length === 0) {
      return new Response(
        superjson.stringify({ error: "No update data provided" }),
        { status: 400 }
      );
    }

    // If slug is provided and non-empty, check uniqueness
    if (validatedInput.slug && validatedInput.slug !== "") {
      const existingUser = await db
        .selectFrom("users")
        .select("id")
        .where("slug", "=", validatedInput.slug)
        .where("id", "!=", effectiveTeacherId)
        .executeTakeFirst();

      if (existingUser) {
        return new Response(
          superjson.stringify({ error: "This URL slug is already taken" }),
          { status: 400 }
        );
      }

      console.log(`Setting custom slug for teacher ${effectiveTeacherId} to: ${validatedInput.slug}`);
    }

    // Build the update object - only include slug if it was provided
    const updateData: Record<string, unknown> = {
      displayName: validatedInput.displayName,
      academyName: validatedInput.academyName,
      avatarUrl: validatedInput.avatarUrl,
      avatarFileId: validatedInput.avatarFileId,
      bio: validatedInput.bio,
      websiteUrl: validatedInput.websiteUrl,
      publicEmail: validatedInput.publicEmail,
      publicPhone: validatedInput.publicPhone,
      socialLinks: validatedInput.socialLinks,
      awardsCertificates: validatedInput.awardsCertificates,
      languages: validatedInput.languages,
      location: validatedInput.location,
      expertiseAreas: validatedInput.expertiseAreas,
      responseTime: validatedInput.responseTime,
      tagline: validatedInput.tagline,
      updatedAt: new Date(),
    };

    // Only update slug if it was explicitly provided
    if (validatedInput.slug !== undefined) {
      updateData.slug = validatedInput.slug;
    }

    const [updatedUser] = await db
      .updateTable("users")
      .set(updateData)
      .where("id", "=", effectiveTeacherId)
      .returningAll()
      .execute();

    if (!updatedUser) {
      return new Response(
        superjson.stringify({ error: "User not found or no changes made" }),
        { status: 404 }
      );
    }

    const output: OutputType = {
      id: updatedUser.id,
      displayName: updatedUser.displayName,
      academyName: updatedUser.academyName,
      email: updatedUser.email,
      avatarUrl: updatedUser.avatarUrl,
      role: updatedUser.role,
            bio: updatedUser.bio,
      websiteUrl: updatedUser.websiteUrl,
      mobileNumber: updatedUser.mobileNumber,
      onboardingCompleted: updatedUser.onboardingCompleted,
      publicEmail: updatedUser.publicEmail,
      publicPhone: updatedUser.publicPhone,
      slug: updatedUser.slug,
      socialLinks: updatedUser.socialLinks as { facebook?: string; twitter?: string; linkedin?: string; instagram?: string; youtube?: string; } | null | undefined,
      awardsCertificates: updatedUser.awardsCertificates as { title: string; description?: string; }[] | null | undefined,
      languages: updatedUser.languages as string[] | null | undefined,
      location: updatedUser.location,
      expertiseAreas: updatedUser.expertiseAreas as string[] | null | undefined,
      responseTime: updatedUser.responseTime,
      tagline: updatedUser.tagline,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error updating teacher profile:", error);
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