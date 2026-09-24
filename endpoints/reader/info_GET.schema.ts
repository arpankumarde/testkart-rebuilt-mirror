import superjson from "superjson";
import {
  readerDocumentQuery,
  readerDocumentRefSchema,
  type ReaderDocumentRef,
} from "../../helpers/readerDocumentRef";

export const schema = readerDocumentRefSchema;

export type InputType = ReaderDocumentRef;

export type OutputType = {
  title: string;
  // Pages this viewer can open: the whole document, or a public preview's share of it.
  totalPages: number;
  firstPage: { width: number; height: number };
};

export const getReaderInfo = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/reader/info?${readerDocumentQuery(schema.parse(params)).toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};