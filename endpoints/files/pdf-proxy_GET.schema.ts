import { z } from "zod";

export const schema = z.object({
  url: z.string().url(),
});

export type InputType = z.infer<typeof schema>;

// Raw PDF bytes are streamed back directly — there's no typed client
// wrapper here, since react-pdf's <Document> fetches the URL itself.
// Components build the proxied URL with helpers/pdfProxyUrl instead.
export type OutputType = string;
