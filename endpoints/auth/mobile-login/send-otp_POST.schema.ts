import { z } from "zod";
import { postAuthRequest } from "../../../helpers/authRequest";

export const schema = z.object({
  mobileNumber: z
    .string()
    .length(10, "Mobile number must be 10 digits")
    .regex(/^[0-9]+$/, "Mobile number must contain only digits"),
  // Optional at the schema level so the endpoint can gracefully no-op the
  // check while TURNSTILE_SECRET_KEY isn't configured yet (see
  // helpers/verifyTurnstileToken.tsx) instead of hard-blocking every OTP
  // send during rollout. Once configured, the handler enforces it's present.
  turnstileToken: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  message: string;
};

export const postSendMobileOtp = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  return postAuthRequest<OutputType>(`/_api/auth/mobile-login/send-otp`, validatedInput, init);
};