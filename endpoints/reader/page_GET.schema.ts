import { z } from "zod";
import { readerDocumentRefSchema, readerPageUrl, type ReaderDocumentRef } from "../../helpers/readerDocumentRef";

export const schema = readerDocumentRefSchema.and(z.object({ page: z.number().int().positive() }));

export type InputType = z.infer<typeof schema>;

// The page comes back as a watermarked WebP image. The reader puts readerPageUrl in an <img>, so there is no
// typed fetch wrapper.
export type OutputType = Blob;

export const pageImageUrl = (ref: ReaderDocumentRef, page: number) => readerPageUrl(ref, page);