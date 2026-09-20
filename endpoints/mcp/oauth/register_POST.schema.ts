import { z } from "zod";
import { RegisterResponse, registerRequestSchema } from "../../../helpers/mcpSchemas";

/** MCP clients such as ChatGPT and Claude register themselves here. Plain JSON. */
export const schema = registerRequestSchema;

export type InputType = z.infer<typeof schema>;

export type OutputType = RegisterResponse;