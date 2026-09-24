import { z } from "zod";

export const schema = z.object({
  id: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;