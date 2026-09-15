import { z } from "zod";
import superjson from "superjson";
import { User } from "../../../helpers/User";
import { UserRoleArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  mobileNumber: z
    .string()
    .length(10, "Mobile number must be 10 digits")
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
  otpCode: z
    .string()
    .length(4, "OTP must be 4 digits")
    .regex(/^\d{4}$/, "OTP must be 4 digits"),
  displayName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long")
    .trim(),
  role: z.enum(UserRoleArrayValues).refine(
    (val) => val === "student" || val === "teacher",
    { message: "Role must be either student or teacher" }
  ),
});

export type InputType = z.infer<typeof schema>;

export type OutputType =
  | {
      user: User;
      token: string;
    }
  | {
      error: string;
    };

export const postVerifyAndRegister = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/auth/mobile-signup/verify-and-register`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const json = superjson.parse(await result.text());

  if (!result.ok) {
    const error = (json as { error: string }).error;
    throw new Error(error || "Failed to register user");
  }

  return json as OutputType;
};