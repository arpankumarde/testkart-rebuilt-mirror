import { z } from "zod";
import { postAuthRequest } from "../../../helpers/authRequest";
import { UserRoleArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  role: z.enum(UserRoleArrayValues).refine(
    (val) => val === "student" || val === "teacher",
    { message: "Role must be either student or teacher" }
  ),
  // Required for teachers by the handler; students never send it.
  mobileNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number")
    .optional(),
  // Optional at the schema level so the endpoint can gracefully no-op the
  // check while TURNSTILE_SECRET_KEY isn't configured (see
  // helpers/verifyTurnstileToken.tsx). Once configured, the handler enforces it.
  turnstileToken: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType =
  | {
      success: boolean;
      message: string;
    }
  | {
      error: string;
    };

export const postSendEmailSignupOtp = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  return postAuthRequest<OutputType>(`/_api/auth/email-signup/send-otp`, validatedInput, init);
};