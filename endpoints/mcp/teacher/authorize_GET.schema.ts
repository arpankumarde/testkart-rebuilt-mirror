import { z } from "zod";
import { authorizeQuerySchema } from "../../../helpers/mcpSchemas";

/** Reached by the teacher's browser, not by this app's frontend, so it returns HTML rather than JSON. */
export const schema = authorizeQuerySchema;

export type InputType = z.infer<typeof schema>;

export type OutputType = never;