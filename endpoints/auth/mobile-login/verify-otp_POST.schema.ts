import { z } from "zod";
import superjson from "superjson";
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
  const result = await fetch(`/_api/auth/mobile-login/verify-otp`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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