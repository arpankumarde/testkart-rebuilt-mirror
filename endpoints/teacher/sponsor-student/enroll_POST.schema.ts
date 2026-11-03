import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  identifier: z.string().min(3, "Identifier must be at least 3 characters"),
  contentId: z.number(),
  contentType: z.enum(["test", "course", "product", "bundle"]),
  /** Ignored: the platform fee is waived, so nothing is charged. Kept so older clients still validate. */
  paymentMethod: z.enum(["balance", "online"]).optional(),
  /** The student account picked in the dialog when several share the identifier; revalidated here. */
  studentUserId: z.number().int().positive().optional(),
  studentName: z.string().optional(),
  studentEmail: z.string().email().optional().or(z.literal("")),
  studentPhone: z.string().optional(),
  sendCredentials: z.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;

// Sponsorship is free for the teacher, so the student is always enrolled immediately.
export type OutputType = {
  requiresPayment: false;
  success: boolean;
  message: string;
  enrollment: {
    studentName: string;
    contentTitle: string;
    /** Always 0: the platform fee is waived. */
    commissionAmount: number;
    enrolledAt: Date;
  };
  newUserCreated: boolean;
  temporaryPassword?: string;
  credentialsSent?: boolean;
};

export const postSponsorStudentEnroll = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/sponsor-student/enroll`, {
    method: "POST",
    body: superjson.stringify(body),
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