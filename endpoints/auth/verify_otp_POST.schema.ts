import { z } from "zod";
import superjson from 'superjson';

const indianMobileRegex = /^(?:\+91)?[6-9]\d{9}$/;

export const schema = z.object({
  mobileNumber: z.string().refine(value => indianMobileRegex.test(value), {
    message: "Please enter a valid 10-digit Indian mobile number.",
  }),
  otpCode: z.string().length(4, "OTP must be 4 digits."),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  message: string;
};

export const postVerifyOtp = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/auth/verify_otp`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};