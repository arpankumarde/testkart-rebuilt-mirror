import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TeacherSubscriptions, SubscriptionPlans } from '../../../helpers/schema';

// No input schema needed for this GET request
export const schema = z.object({});

// OutputType matches what the endpoint returns: subscription fields + plan fields flattened
export type OutputType = Selectable<TeacherSubscriptions> & {
  planName: string;
  planPrice: number;
  planDurationDays: number;
  platformFeePercentage: number;
};

export type SubscriptionStatusDetails = OutputType | null;

export const getTeacherSubscriptionStatus = async (
init?: RequestInit)
: Promise<SubscriptionStatusDetails> => {
  const result = await fetch(`/_api/teacher/subscription/status`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{error: string;}>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<SubscriptionStatusDetails>(await result.text());
};