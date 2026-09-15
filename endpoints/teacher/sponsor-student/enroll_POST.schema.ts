import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  identifier: z.string().min(3, "Identifier must be at least 3 characters"),
  contentId: z.number(),
  contentType: z.enum(["test", "course", "product", "bundle"]),
  paymentMethod: z.enum(["balance", "online"]),
  studentName: z.string().optional(),
  studentEmail: z.string().email().optional().or(z.literal("")),
  studentPhone: z.string().optional(),
  sendCredentials: z.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;

// Discriminated union based on payment method
export type OutputType =
  | {
      requiresPayment: false;
      success: boolean;
      message: string;
      enrollment: {
        studentName: string;
        contentTitle: string;
        commissionAmount: number;
        enrolledAt: Date;
      };
      newBalance: number;
      newUserCreated: boolean;
      temporaryPassword?: string;
      credentialsSent?: boolean;
    }
  | {
      requiresPayment: true;
      paymentData: {
        key: string;
        txnid: string;
        amount: string;
        productinfo: string;
        firstname: string;
        email: string;
        phone: string;
        surl: string;
        furl: string;
        hash: string;
        payuUrl: string;
      };
      enrollmentId: number;
      orderId: number;
      newUserCreated: boolean;
      temporaryPassword?: string;
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