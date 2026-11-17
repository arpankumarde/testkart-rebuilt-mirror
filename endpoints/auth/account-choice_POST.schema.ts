import { z } from "zod";
import { postAuthRequest } from "../../helpers/authRequest";
import { User } from "../../helpers/User";

export const schema = z.object({
  choiceToken: z.string().min(1),
  /** "existing": sign into the account on the other side. "create": set up an account on this side. */
  choice: z.enum(["existing", "create"]),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  user: User;
  token: string;
};

export const postAccountChoice = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  return postAuthRequest<OutputType>(`/_api/auth/account-choice`, validatedInput, init);
};
