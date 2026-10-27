import { z } from "zod";
import { postAuthRequest } from "../../../helpers/authRequest";

export const schema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  // Optional at the schema level so the endpoint can gracefully no-op the
  // check while TURNSTILE_SECRET_KEY isn't configured (see
  // helpers/verifyTurnstileToken.tsx). Once configured, the handler enforces it.
  turnstileToken: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  message: string;
};

export const postSendEmailLoginOtp = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  return postAuthRequest<OutputType>(`/_api/auth/email-login/send-otp`, validatedInput, init);
};