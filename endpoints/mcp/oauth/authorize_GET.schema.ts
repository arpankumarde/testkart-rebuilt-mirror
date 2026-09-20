import { z } from "zod";
import { authorizeQuerySchema } from "../../../helpers/mcpSchemas";

/** Reached by the user's browser from an MCP client; it redirects rather than returning JSON. */
export const schema = authorizeQuerySchema;

export type InputType = z.infer<typeof schema>;

export type OutputType = never;