import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { LiveTests } from "../../../helpers/schema";

export const LiveTestStatusArray = [
  "draft",
  "upcoming",
  "live",
  "ended",
  "registration_closed",
  "seats_full",
] as const;
export type LiveTestStatus = (typeof LiveTestStatusArray)[number];

/*
 * Subsets the teacher dashboard links to. Each uses the same condition as the
 * matching count in teacher/dashboard/overview_GET, is applied before
 * pagination, and takes precedence over status.
 */
export const LiveTestListFilterValues = ["prizes-pending", "starting-soon", "active"] as const;
export type LiveTestListFilter = (typeof LiveTestListFilterValues)[number];

export const schema = z.object({
  status: z.enum(["all", ...LiveTestStatusArray]).optional(),
  filter: z.enum(LiveTestListFilterValues).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
  /* Only the live test behind this mock test, if there is one. Applied before pagination. */
  mockTestId: z.coerce.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type TeacherLiveTestItem = Omit<Selectable<LiveTests>, "price" | "totalPrizePool" | "firstPrize" | "secondPrize" | "thirdPrize" | "actualTotalDistributed"> & {
  price: number;
  totalPrizePool: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
  actualTotalDistributed: number;
  actualRevenue: number;
  durationMinutes: number;
  firstTestItemId: number | null;
  calculatorEnabled: boolean;
  subjectWiseTiming: boolean;
  questionWiseTiming: boolean;
  status: LiveTestStatus;
};

export type OutputType = {
  tests: TeacherLiveTestItem[];
  total: number;
  page: number;
  limit: number;
  /* The mock test behind every one of the teacher's live tests, whatever the status, filter or page. */
  mockTestIds: number[];
};

export const getTeacherLiveTestsList = async (
  filters: Partial<InputType> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams();

  if (filters.status) params.append("status", filters.status);
  if (filters.filter) params.append("filter", filters.filter);
  if (filters.page) params.append("page", filters.page.toString());
  if (filters.limit) params.append("limit", filters.limit.toString());
  if (filters.mockTestId) params.append("mockTestId", filters.mockTestId.toString());

  const queryString = params.toString();
  const url = `/_api/teacher/live-tests/list${queryString ? `?${queryString}` : ""}`;

  const result = await fetch(url, {
    method: "GET",
    cache: "no-store",
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