import { z } from "zod";
import { postAuthRequest } from "../../../helpers/authRequest";
import { UserRoleArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  mobileNumber: z
    .string()
    .length(10, "Mobile number must be 10 digits")
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
  role: z.enum(UserRoleArrayValues).refine(
    (val) => val === "student" || val === "teacher",
    { message: "Role must be either student or teacher" }
  ),
  // Required for teachers by the handler; students never send it.
  email: z.string().trim().toLowerCase().email("Please enter a valid email address").optional(),
  // Optional at the schema level so the endpoint can gracefully no-op the
  // check while TURNSTILE_SECRET_KEY isn't configured yet (see
  // helpers/verifyTurnstileToken.tsx) instead of hard-blocking every OTP
  // send during rollout. Once configured, the handler enforces it's present.
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

export const postSendMobileSignupOtp = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  return postAuthRequest<OutputType>(`/_api/auth/mobile-signup/send-otp`, validatedInput, init);
};