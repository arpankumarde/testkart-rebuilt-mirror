import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address").max(255),
  subject: z.string().max(255).optional(),
  message: z.string().min(1, "Message is required").max(5000),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  submissionId: number;
};

export const postContactSubmit = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/contact/submit`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const responseJson = superjson.parse(await result.text());

  if (!result.ok) {
    const errorObject = responseJson as { error: string };
    throw new Error(errorObject.error || "Failed to submit contact form");
  }

  return responseJson as OutputType;
};