import { z } from "zod";
import superjson from "superjson";

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
  const result = await fetch(`/_api/auth/email-login/send-otp`, {
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