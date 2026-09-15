import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type SponsoredEnrollment = {
  id: number;
  studentName: string;
  studentPhone: string;
  contentTitle: string;
  contentType: string;
  itemPrice: number;
  commissionAmount: number;
  paymentMethod: string;
  wasNewUser: boolean;
  enrolledAt: Date | null;
  notes: string | null;
  orderStatus: string | null;
};

export type OutputType = {
  sponsoredEnrollments: SponsoredEnrollment[];
};

export const getSponsoredEnrollmentsList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/sponsor-student/list`, {
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