import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type NewsListItem = {
  id: number;
  title: string;
  slug: string;
  publicationName: string | null;
  imageUrl: string;
  excerpt: string | null;
  publishedAt: Date;
};

export type OutputType = {
  items: NewsListItem[];
};

export const getNewsList = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/news/list`, {
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
