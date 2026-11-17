import { z } from "zod";
import { postAuthRequest } from "../../../helpers/authRequest";
import { User } from "../../../helpers/User";
export type { AccountChoiceOutput } from "../../../helpers/loginAccount";

export const schema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  otpCode: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^[0-9]+$/, "OTP must contain only digits"),
  role: z.enum(["user", "teacher"]).optional().default("user"),
  /** Clients that can show the "you have an account on the other side" choice (helpers/loginAccount). */
  supportsAccountChoice: z.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  user: User;
  token: string;
};

/** A session, or the account choice when only the other side has an account and supportsAccountChoice was sent. */
export type VerifyResult = OutputType | import("../../../helpers/loginAccount").AccountChoiceOutput;

export const postVerifyEmailLoginOtp = async (
  body: InputType,
  init?: RequestInit
): Promise<VerifyResult> => {
  const validatedInput = schema.parse(body);
  return postAuthRequest<VerifyResult>(`/_api/auth/email-login/verify-otp`, validatedInput, init);
};