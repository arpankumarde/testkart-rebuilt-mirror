import { z } from "zod";
import superjson from "superjson";
import {
  SalesStageArrayValues,
  SalesStage,
  CallDisposition,
  SalesContactSourceArrayValues,
  SalesContactSource,
} from "../../../helpers/schema";

export const SalesContactSortValues = ["newest", "follow_up_date", "last_contacted", "name", "stage"] as const;
export type SalesContactSort = (typeof SalesContactSortValues)[number];

export const schema = z.object({
  search: z.string().optional(),
  stage: z.enum(SalesStageArrayValues).optional(),
  source: z.enum(SalesContactSourceArrayValues).optional(),
  assignedTo: z.number().int().positive().optional(),
  followUpFilter: z.enum(["today", "overdue", "upcoming", "unscheduled"]).optional(),
  myLeads: z.enum(["true", "false"]).optional(),
  sort: z.enum(SalesContactSortValues).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  signupDateFrom: z.string().optional(),
  signupDateTo: z.string().optional(),
  /* Leads still in play (new, follow up, qualified) whose follow-up day is before today in IST. */
  openOverdue: z.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;

export type ContactNote = {
  id: number;
  note: string;
  createdBy: string;
  createdAt: Date | null;
  disposition: CallDisposition | null;
};

export type SalesContactView = {
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
  notes: ContactNote[];
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
  assignedToAdminId: number | null;
  assignedToAdminName: string | null;
  followUpDate: Date | null;
  lastContactedAt: Date | null;
};

export type OutputType = {
  contacts: SalesContactView[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  stats: {
    total: number;
    new: number;
    followUp: number;
    qualified: number;
    converted: number;
    notInterested: number;
    demoRequests: number;
  };
};

export const getAdminSalesContacts = async (
  params: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  if (params.search) queryParams.set("search", params.search);
  if (params.stage) queryParams.set("stage", params.stage);
  if (params.source) queryParams.set("source", params.source);
  if (params.assignedTo) queryParams.set("assignedTo", params.assignedTo.toString());
  if (params.followUpFilter) queryParams.set("followUpFilter", params.followUpFilter);
  if (params.myLeads) queryParams.set("myLeads", params.myLeads);
  if (params.sort) queryParams.set("sort", params.sort);
  if (params.sortOrder) queryParams.set("sortOrder", params.sortOrder);
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.signupDateFrom) queryParams.set("signupDateFrom", params.signupDateFrom);
  if (params.signupDateTo) queryParams.set("signupDateTo", params.signupDateTo);
  if (params.openOverdue) queryParams.set("openOverdue", "true");

  const result = await fetch(`/_api/admin/sales/contacts?${queryParams.toString()}`, {
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