import { z } from "zod";
import superjson from "superjson";
import { SalesStage, CallDisposition, SalesActivityType, SalesContactSource } from "../../../../helpers/schema";

export const schema = z.object({
  contactId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type ContactDetailNote = {
  id: number;
  note: string;
  createdBy: string;
  createdAt: Date | null;
  disposition: CallDisposition | null;
};

export type ContactDetailActivity = {
  id: number;
  activityType: SalesActivityType;
  oldValue: string | null;
  newValue: string | null;
  details: string | null;
  createdBy: string;
  createdAt: Date | null;
};

export type ContactDetailStats = {
  testsCount: number;
  coursesCount: number;
  productsCount: number;
  bundlesCount: number;
  liveTestsCount: number;
};

export type SalesContactFullDetail = {
  id: number;
  /** Null for website leads that never signed up (source = "demo_request"). */
  userId: number | null;
  source: SalesContactSource;
  /** Self-reported expertise from the "Book a demo" popup; null for signup contacts. */
  leadExpertise: string | null;
  /** IST day the lead asked to be called on, as "YYYY-MM-DD". Null for signup contacts. */
  preferredCallDate: string | null;
  /** Start of the IST hour the lead picked, as "HH:MM". Null for signup contacts. */
  preferredCallSlot: string | null;
  displayName: string;
  email: string | null;
  mobileNumber: string | null;
  academyName: string | null;
  location: string | null;
  stage: SalesStage;
  signedUpAt: Date | null;
  importedAt: Date | null;
  updatedAt: Date | null;
  onboardingCompleted: boolean;
  teachingCategories: unknown;
  targetExams: unknown;
  teachingExperienceLevel: string | null;
  currentOccupation: string | null;
  goals: string | null;
  discoverySource: string | null;
  schoolCollegeName: string | null;
  signupSource: string | null;
  productInterest: unknown;
  expertiseAreas: unknown;
  languages: unknown;
  bio: string | null;
  tagline: string | null;
  avatarUrl: string | null;
  assignedToAdminId: number | null;
  assignedToAdminName: string | null;
  followUpDate: Date | null;
  lastContactedAt: Date | null;
};

export type OutputType = {
  contact: SalesContactFullDetail;
  notes: ContactDetailNote[];
  activities: ContactDetailActivity[];
  contentStats: ContactDetailStats;
};

export const getAdminSalesContactDetail = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  queryParams.set("contactId", params.contactId.toString());

  const result = await fetch(`/_api/admin/sales/contacts/detail?${queryParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  
  return superjson.parse<OutputType>(await result.text());
};