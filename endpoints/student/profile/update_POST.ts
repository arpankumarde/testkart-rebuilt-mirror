import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { ZodError } from "zod";
import { Selectable } from "kysely";
import { Users } from "../../../helpers/schema";
import { User } from "../../../helpers/User";
import { isPlaceholderDisplayName, PLACEHOLDER_NAME_SQL_REGEX } from "../../../helpers/isPlaceholderDisplayName";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);

    // Allow students and admins to update student profiles
    if (user.role !== "student" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
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

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    
    // The mobile app always resends the current name, so an unchanged placeholder passes; switching to one does not.
    const nameChanged =
      validatedInput.displayName !== undefined && validatedInput.displayName.trim() !== (user.displayName ?? "").trim();
    if (nameChanged && isPlaceholderDisplayName(validatedInput.displayName)) {
      return new Response(
        superjson.stringify({ error: "Please enter your real name, not User_ or User followed by a number." }),
        { status: 400 }
      );
    }

    if (validatedInput.displayName !== undefined) {
      updateData.displayName = validatedInput.displayName;
    }
    if (validatedInput.avatarUrl !== undefined) {
      updateData.avatarUrl = validatedInput.avatarUrl;
    }
    if (validatedInput.avatarFileId !== undefined) {
      updateData.avatarFileId = validatedInput.avatarFileId;
    }
    if (validatedInput.bio !== undefined) {
      updateData.bio = validatedInput.bio;
    }

    const [updatedUser] = await db
      .updateTable("users")
      .set(updateData)
      .where("id", "=", user.id)
      .returningAll()
      .execute();

    if (!updatedUser) {
      return new Response(
        superjson.stringify({ error: "User not found or no changes made" }),
        { status: 404 }
      );
    }

    // Reviews keep a copy of the name they were written under; give the ones left under a generated name the real one.
    if (nameChanged && !isPlaceholderDisplayName(updatedUser.displayName)) {
      await db
        .updateTable("reviews")
        .set({ reviewerName: updatedUser.displayName })
        .where("userId", "=", user.id)
        .where("reviewerName", "~*", PLACEHOLDER_NAME_SQL_REGEX)
        .execute();
    }
    
    const mapUser = (dbUser: Selectable<Users>): User => ({
      id: dbUser.id,
      displayName: dbUser.displayName,
      email: dbUser.email,
      avatarUrl: dbUser.avatarUrl,
      role: dbUser.role,
      bio: dbUser.bio,
            websiteUrl: dbUser.websiteUrl,
      socialLinks: dbUser.socialLinks as User['socialLinks'],
      awardsCertificates: dbUser.awardsCertificates as User['awardsCertificates'],
      mobileNumber: dbUser.mobileNumber,
      mobileVerified: dbUser.mobileVerified,
    });

    const output: OutputType = mapUser(updatedUser);

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error updating student profile:", error);
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