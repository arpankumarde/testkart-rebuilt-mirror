import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { LiveTests, Users, MockTests } from "../../helpers/schema";
import { SocialLinks, AwardCertificate } from "../../helpers/teacherProfileTypes";

// The shipped mobile app looks a live test up by id; the web page uses its slug.
export const schema = z.union([
  z.object({ id: z.number().int().positive() }),
  z.object({ slug: z.string().min(1) }),
]);

export type InputType = z.infer<typeof schema>;

export type TeacherProfile = {
  id: number;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  websiteUrl: string | null;
  socialLinks: SocialLinks | null;
  awardsCertificates: AwardCertificate[] | null;
  publicPhone?: string | null;
  publicEmail?: string | null;
  academyName?: string | null;
};

export type MockTestInfo = {
  id: number;
  title: string;
  description: string | null;
  examName: string | null;
  durationMinutes: number;
  totalQuestions: number;
  subject: string | null;
  firstTestItemId: number;
};

export type OutputType = Omit<Selectable<LiveTests>, "price" | "discountPrice" | "totalPrizePool" | "firstPrize" | "secondPrize" | "thirdPrize"> & {
  price: number;
  /** The valid discounted price students pay, or null when the list price applies. */
  discountPrice: number | null;
  totalPrizePool: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
  isEnrolled: boolean;
  canEnroll: boolean;
  hasAttempted: boolean;
  examSlug: string | null;
  /** The live test's public URL slug, /live-test/:slug (stored on its own mock test package). */
  slug: string;
  teacherIsVerified: boolean;
  teacherSlug: string;
  teacherProfile: TeacherProfile;
  mockTestDetails: MockTestInfo;
  disclaimer: string;
};

export const getLiveTestsDetails = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams(
    "id" in validatedParams ? { id: validatedParams.id.toString() } : { slug: validatedParams.slug }
  );

  const result = await fetch(
    `/_api/live-tests/details?${searchParams.toString()}`,
    {
      method: "GET",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }
  );

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};