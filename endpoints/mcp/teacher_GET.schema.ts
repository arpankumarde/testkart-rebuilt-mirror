import { z } from "zod";

/** MCP clients probe the connector URL with GET; it takes no input. */
export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = never;