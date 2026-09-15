import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CourseBundles, Courses, DigitalProducts, MockTests } from "../../helpers/schema";

export const schema = z.object({
  slug: z.string().min(1),
});

export type InputType = z.infer<typeof schema>;

type BundleCourse = Pick<
  Selectable<Courses>,
  | "id"
  | "title"
  | "slug"
  | "description"
  | "thumbnailUrl"
  | "level"
  | "language"
> & {
  price: number;
  orderIndex: number;
};

type BundleTest = Pick<
  Selectable<MockTests>,
  | "id"
  | "title"
  | "slug"
  | "description"
  | "thumbnailUrl"
  | "durationMinutes"
  | "totalQuestions"
  | "language"
> & {
  price: number;
  orderIndex: number;
};

type BundleDigitalProduct = Pick<
  Selectable<DigitalProducts>,
  | "id"
  | "title"
  | "slug"
  | "description"
  | "thumbnailUrl"
  | "language"
  | "pageCount"
> & {
  price: number;
  orderIndex: number;
};

type BundleItem =
  | ({ type: "course" } & BundleCourse)
  | ({ type: "test" } & BundleTest)
  | ({ type: "digital_product" } & BundleDigitalProduct);

export type BundleSeo = {
  indexable: boolean;
  qualityScore: number;
  robots: "index,follow" | "noindex,follow";
};

export type OutputType = Omit<
  Selectable<CourseBundles>,
  "price" | "originalPrice" | "discountPercentage"
> & {
  price: number;
  originalPrice: number;
  discountPercentage: number | null;
  seo: BundleSeo;
  teacher: {
    id: number;
    displayName: string;
    profilePicture: string | null;
  };
  items: BundleItem[];
  isEnrolled: boolean;
  disclaimer: string;
};

export const getBundlesDetails = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    slug: validatedParams.slug,
  });

  const result = await fetch(
    `/_api/bundles/details?${searchParams.toString()}`,
    {
      method: "GET",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }
  );

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};