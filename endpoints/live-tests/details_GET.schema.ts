import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { LiveTests, Users, MockTests } from "../../helpers/schema";
import { SocialLinks, AwardCertificate } from "../../helpers/teacherProfileTypes";

export const schema = z.object({
  id: z.number().int().positive(),
});

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

export type OutputType = Omit<Selectable<LiveTests>, "price" | "totalPrizePool" | "firstPrize" | "secondPrize" | "thirdPrize"> & {
  price: number;
  totalPrizePool: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
  isEnrolled: boolean;
  canEnroll: boolean;
  hasAttempted: boolean;
  examSlug: string | null;
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
  const searchParams = new URLSearchParams({
    id: validatedParams.id.toString(),
  });

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