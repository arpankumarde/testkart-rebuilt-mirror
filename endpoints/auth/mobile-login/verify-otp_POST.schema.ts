import { z } from "zod";
import { postAuthRequest } from "../../../helpers/authRequest";
import { User } from "../../../helpers/User";
export type { AccountChoiceOutput } from "../../../helpers/loginAccount";

export const schema = z.object({
  mobileNumber: z
    .string()
    .length(10, "Mobile number must be 10 digits")
    .regex(/^[0-9]+$/, "Mobile number must contain only digits"),
  otpCode: z
    .string()
    .length(4, "OTP must be 4 digits")
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

export const postVerifyMobileOtp = async (
  body: InputType,
  init?: RequestInit
): Promise<VerifyResult> => {
  const validatedInput = schema.parse(body);
  return postAuthRequest<VerifyResult>(`/_api/auth/mobile-login/verify-otp`, validatedInput, init);
};