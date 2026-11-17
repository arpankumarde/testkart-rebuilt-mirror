import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { LiveTests, Teachers, MockTests } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type AdminLiveTestListItem = Pick<
  Selectable<LiveTests>,
  | "id"
  | "title"
  | "startTime"
  | "endTime"
  | "enrolledCount"
  | "maxSeats"
  | "isActive"
  | "hasPrizes"
  | "prizeDistributionStatus"
  | "createdAt"
> & {
  price: number;
  totalPrizePool: number;
  teacherName: Selectable<Teachers>["displayName"];
  teacherId: Selectable<Teachers>["id"];
  mockTestTitle: Selectable<MockTests>["title"];
  /** Public URL slug, /live-test/:slug. */
  slug: Selectable<MockTests>["slug"];
};

export type OutputType = AdminLiveTestListItem[];

export const getAdminLiveTestsList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/live-tests/list`, {
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