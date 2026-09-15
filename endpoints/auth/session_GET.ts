import {
  setServerSession,
  NotAuthenticatedError,
} from "../../helpers/getSetServerSession";
import { User } from "../../helpers/User";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import superjson from "superjson";
import { OutputType } from "./session_GET.schema";

export async function handle(request: Request) {
  try {
    // Get session and basic user info
    // This also validates the session
    const { user, session, impersonatorAdminId } = await getServerUserSession(
      request
    );

    // Fetch additional user profile fields that are not returned by getServerUserSession
    const userProfile = await db
      .selectFrom("users")
      .select([
        "avatarFileId",
        "bio",
        "emailVerified",
        "websiteUrl",
        "publicEmail",
        "publicPhone",
        "socialLinks",
        "awardsCertificates",
        "languages",
        "location",
        "expertiseAreas",
        "responseTime",
        "tagline",
        "slug",
        "onboardingCompleted",
        "isVerified",
        "instituteType",
        "academyName",
        "yearsOfExperience",
       "teachingCategories",
       "targetExams",
       "teachingExperienceLevel",
       "currentOccupation",
       "goals",
       "discoverySource",
       "schoolCollegeName",
       "signupSource",
      ])
      .where("id", "=", user.id)
      .executeTakeFirst();

        // Merge basic user info with profile info
    const fullUser: User = {
      ...user,
      avatarFileId: userProfile?.avatarFileId,
      bio: userProfile?.bio,
      emailVerified: userProfile?.emailVerified ?? false,
      websiteUrl: userProfile?.websiteUrl,
      publicEmail: userProfile?.publicEmail,
      publicPhone: userProfile?.publicPhone,
      socialLinks: userProfile?.socialLinks as User["socialLinks"],
      awardsCertificates: userProfile?.awardsCertificates as User["awardsCertificates"],
      languages: userProfile?.languages as string[] | null,
      location: userProfile?.location,
      expertiseAreas: userProfile?.expertiseAreas as string[] | null,
      responseTime: userProfile?.responseTime,
      tagline: userProfile?.tagline,
      slug: userProfile?.slug,
      onboardingCompleted: userProfile?.onboardingCompleted,
      isVerified: userProfile?.isVerified,
      instituteType: userProfile?.instituteType,
      academyName: userProfile?.academyName,
      yearsOfExperience: userProfile?.yearsOfExperience,
     teachingCategories: userProfile?.teachingCategories as string[] | null,
     targetExams: userProfile?.targetExams as string[] | null,
     teachingExperienceLevel: userProfile?.teachingExperienceLevel,
     currentOccupation: userProfile?.currentOccupation,
     goals: userProfile?.goals,
     discoverySource: userProfile?.discoverySource,
     schoolCollegeName: userProfile?.schoolCollegeName,
     signupSource: userProfile?.signupSource,
    };

    // Create response body
    const responseBody: OutputType = {
      user: fullUser,
      impersonatorAdminId: impersonatorAdminId ?? undefined,
    };

    // Use superjson for serialization to support complex types (if any) and consistency
    const response = new Response(superjson.stringify(responseBody), {
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Update the session cookie with the new lastAccessed time
    await setServerSession(response, {
      id: session.id,
      createdAt: session.createdAt,
      lastAccessed: typeof session.lastAccessed === 'number' ? session.lastAccessed : new Date(session.lastAccessed).getTime(),
    });

    return response;
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      const errorBody: OutputType = { error: "Not authenticated" };
      return new Response(superjson.stringify(errorBody), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("Session validation error:", error);
    const errorBody: OutputType = { error: "Session validation failed" };
    return new Response(superjson.stringify(errorBody), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}