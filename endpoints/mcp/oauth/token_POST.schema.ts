import { z } from "zod";
import { TokenResponse, tokenRequestSchema } from "../../../helpers/mcpSchemas";

/** Clients post application/x-www-form-urlencoded per RFC 6749, not a JSON body. */
export const schema = tokenRequestSchema;

export type InputType = z.infer<typeof schema>;

export type OutputType = TokenResponse;