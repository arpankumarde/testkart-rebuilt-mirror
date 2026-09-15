import { z } from "zod";
import superjson from "superjson";
import { User } from "../../../helpers/User";
import { UserRoleArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  otpCode: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must be 6 digits"),
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

export const postVerifyEmailSignupAndRegister = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/auth/email-signup/verify-and-register`, {
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