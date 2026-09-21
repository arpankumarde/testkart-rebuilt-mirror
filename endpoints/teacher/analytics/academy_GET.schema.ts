import { z } from "zod";
import superjson from "superjson";
import { AnalyticsRangeValues, AnalyticsRange, AnalyticsBucket } from "../../../helpers/teacherAnalyticsTime";
import type { StorefrontEntity } from "../../analytics/track_POST.schema";

export const schema = z.object({
  range: z.enum(AnalyticsRangeValues).default("30d"),
});

export type InputType = z.infer<typeof schema>;

/**
 * Visitors are browsers (one per device and browser, kept across visits);
 * converted counts signed-in visitors who bought or claimed something from
 * this teacher in the same period.
 */
export type AcademyMetrics = {
  views: number;
  visitors: number;
  carts: number;
  shares: number;
  converted: number;
};

export type AcademyPoint = { bucket: string; views: number; visitors: number };

export type AcademyBreakdown = AcademyMetrics & { key: string };

export type OutputType = {
  range: AnalyticsRange;
  bucket: AnalyticsBucket;
  generatedAt: Date;
  /** When visit tracking started on the site; nothing before it is counted. */
  trackingSince: Date | null;
  current: AcademyMetrics;
  previous: AcademyMetrics;
  series: AcademyPoint[];
  /** Keyed by storefront entity: teacher_profile is the public profile page. */
  byEntity: AcademyBreakdown[];
  /** share_whatsapp ... share_copy, campaign, search, social, internal, referral, direct. */
  sources: AcademyBreakdown[];
  devices: AcademyBreakdown[];
  /** utm_campaign of tagged visits: which share surface the link came from. */
  campaigns: AcademyBreakdown[];
  /** Share button presses by platform, and by the surface they were pressed on. */
  sharePlatforms: AcademyBreakdown[];
  shareCampaigns: AcademyBreakdown[];
  funnel: { visitors: number; addedToCart: number; startedPayment: number; paid: number };
  /** The older all-time counters on each item, which count every page load since the item went live. */
  lifetimeViews: Record<Exclude<StorefrontEntity, "bundle" | "teacher_profile">, number>;
};

export const getTeacherAnalyticsAcademy = async (query: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ range: query.range });
  const result = await fetch(`/_api/teacher/analytics/academy?${params.toString()}`, {
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