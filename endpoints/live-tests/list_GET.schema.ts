import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { LiveTests, Users } from "../../helpers/schema";

export const LiveTestStatusArray = [
  "upcoming",
  "live",
  "ended",
  "registration_closed",
  "seats_full",
] as const;
export type LiveTestStatus = (typeof LiveTestStatusArray)[number];

export const schema = z.object({
  status: z.enum(["all", ...LiveTestStatusArray]).optional(),
  examName: z.string().optional(),
  searchQuery: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
});

export type InputType = z.infer<typeof schema>;

export type LiveTestListItem = Pick<
  Selectable<LiveTests>,
  | "id"
  | "title"
  | "description"
  | "startTime"
  | "endTime"
  | "registrationDeadline"
  | "maxSeats"
  | "enrolledCount"
  | "thumbnailUrl"
  | "introVideoUrl"
  | "hasPrizes"
  | "viewCount"
> & {
  examName: string | null;
  price: number;
  totalPrizePool: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
  teacherName: Selectable<Users>["displayName"];
  teacherIsVerified: boolean;
  isEnrolled: boolean;
  hasAttempted: boolean;
  status: LiveTestStatus;
  durationMinutes: number;
  language: string | null;
  actualQuestionCount: number;
  subjects: string | null;
  examSlug: string | null;
};

export type OutputType = {
  tests: LiveTestListItem[];
  total: number;
  page: number;
  limit: number;
};

export const getLiveTestsList = async (
  filters: Partial<InputType> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams();

  if (filters.status) params.append("status", filters.status);
  if (filters.examName) params.append("examName", filters.examName);
  if (filters.searchQuery) params.append("searchQuery", filters.searchQuery);
  if (filters.page) params.append("page", filters.page.toString());
  if (filters.limit) params.append("limit", filters.limit.toString());

  const queryString = params.toString();
  const url = `/_api/live-tests/list${queryString ? `?${queryString}` : ""}`;

  const result = await fetch(url, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};