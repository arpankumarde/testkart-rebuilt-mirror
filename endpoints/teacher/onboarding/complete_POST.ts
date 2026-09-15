import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./complete_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { ZodError } from "zod";
import { User } from "../../../helpers/User";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized: teacher role required" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    // Only set signupSource if it's provided and the user doesn't already have one
    let signupSourceValue: string | undefined = undefined;
    if (validatedInput.signupSource) {
      const existingUser = await db
        .selectFrom("users")
        .select("signupSource")
        .where("id", "=", effectiveTeacherId)
        .executeTakeFirst();
      
      if (!existingUser?.signupSource) {
        signupSourceValue = validatedInput.signupSource;
      }
    }

    const [updatedUser] = await db
      .updateTable("users")
      .set({
        teachingCategories: validatedInput.teachingCategories,
        expertiseAreas: validatedInput.subjects,
        targetExams: validatedInput.targetExams,
        teachingExperienceLevel: validatedInput.teachingExperienceLevel,
        currentOccupation: validatedInput.currentOccupation,
        productInterest: validatedInput.contentTypes,
        languages: validatedInput.languages,
        goals: validatedInput.goals,
        discoverySource: validatedInput.discoverySource,
        academyName: validatedInput.academyName ?? null,
        schoolCollegeName: validatedInput.schoolCollegeName ?? null,
        location: validatedInput.location ?? null,
        websiteUrl: validatedInput.websiteUrl ?? null,
        socialLinks: validatedInput.socialLinks ?? null,
        ...(signupSourceValue !== undefined && { signupSource: signupSourceValue }),
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where("id", "=", effectiveTeacherId)
      .returningAll()
      .execute();

    if (!updatedUser) {
      return new Response(
        superjson.stringify({ error: "User not found" }),
        { status: 404 }
      );
    }

    const output: OutputType = {
      id: updatedUser.id,
      email: updatedUser.email,
      displayName: updatedUser.displayName,
      avatarUrl: updatedUser.avatarUrl,
      avatarFileId: updatedUser.avatarFileId,
      role: updatedUser.role,
      bio: updatedUser.bio,
      websiteUrl: updatedUser.websiteUrl,
      mobileNumber: updatedUser.mobileNumber,
      mobileVerified: updatedUser.mobileVerified,
      publicEmail: updatedUser.publicEmail,
      publicPhone: updatedUser.publicPhone,
      tagline: updatedUser.tagline,
      location: updatedUser.location,
      languages: updatedUser.languages as string[] | null | undefined,
      expertiseAreas: updatedUser.expertiseAreas as string[] | null | undefined,
      responseTime: updatedUser.responseTime,
      socialLinks: updatedUser.socialLinks as User["socialLinks"],
      awardsCertificates: updatedUser.awardsCertificates as User["awardsCertificates"],
      teachingCategories: updatedUser.teachingCategories as string[] | null,
      targetExams: updatedUser.targetExams as string[] | null,
      teachingExperienceLevel: updatedUser.teachingExperienceLevel,
      currentOccupation: updatedUser.currentOccupation,
      goals: updatedUser.goals,
      discoverySource: updatedUser.discoverySource,
      schoolCollegeName: updatedUser.schoolCollegeName,
      signupSource: updatedUser.signupSource,
      onboardingCompleted: true,
    };

    console.log(`Teacher onboarding completed for user ${user.id}`);

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error completing teacher onboarding:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(
        superjson.stringify({ error: "Not authenticated" }),
        { status: 401 }
      );
    }
    if (error instanceof ZodError) {
      return new Response(
        superjson.stringify({ error: error.errors[0]?.message ?? "Validation error" }),
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      return new Response(
        superjson.stringify({ error: error.message }),
        { status: 500 }
      );
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}