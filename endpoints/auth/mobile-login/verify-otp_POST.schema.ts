import { z } from "zod";
import { postAuthRequest } from "../../../helpers/authRequest";
import { User } from "../../../helpers/User";

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
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  user: User;
  token: string;
};

export const postVerifyMobileOtp = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  return postAuthRequest<OutputType>(`/_api/auth/mobile-login/verify-otp`, validatedInput, init);
};