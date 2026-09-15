import { z } from "zod";
import { consentFormSchema } from "../../../helpers/mcpSchemas";

/** Sent as form data by the consent page, so the OAuth parameters arrive as hidden fields. */
export const schema = consentFormSchema;

export type InputType = z.infer<typeof schema>;

export type OutputType = never;