import { z } from "zod";
import superjson from "superjson";
import { LiveTestStatus } from "../../helpers/liveTestStatus";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type EnrolledLiveTestItem = {
  id: number;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  price: string | number;
  startTime: Date | null;
  endTime: Date;
  teacherName: string;
  enrolledCount: number;
  maxSeats: number;
  hasPrizes: boolean;
  totalPrizePool: string | number;
  firstPrize: string | number;
  secondPrize: string | number;
  thirdPrize: string | number;
  status: LiveTestStatus;
  hasAttempted: boolean;
  mockTestId: number;
  enrolledAt: Date;
};

export type OutputType = {
  enrolledLiveTests: EnrolledLiveTestItem[];
};

export const getStudentEnrolledLiveTests = async (
  body: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/student/enrolled-live-tests`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};