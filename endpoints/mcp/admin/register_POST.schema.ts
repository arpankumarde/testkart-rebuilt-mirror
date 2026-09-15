import { z } from "zod";
import { RegisterResponse, registerRequestSchema } from "../../../helpers/mcpSchemas";

/** Claude.ai registers itself here rather than using a pre-shared client id. Plain JSON. */
export const schema = registerRequestSchema;

export type InputType = z.infer<typeof schema>;

export type OutputType = RegisterResponse;