import { z } from "zod";
import superjson from "superjson";
import { TestListItem } from "../tests/list_GET.schema";
import { LiveTestListItem } from "../live-tests/list_GET.schema";
import { CourseListItem } from "../courses/list_GET.schema";
import { ShopProductListItem } from "../shop/list_GET.schema";
import { TeacherPublicProfile, WorkExperience } from "../../helpers/teacherProfileTypes";
import type { TeacherProfileBundle } from "../../helpers/loadTeacherProfileBundles";

export const schema = z.object({
  teacherSlug: z.string(),
});

export type InputType = z.infer<typeof schema>;

export type { TeacherPublicProfile, WorkExperience, TestListItem, LiveTestListItem, CourseListItem, ShopProductListItem, TeacherProfileBundle };

export type OutputType = {
  teacher: TeacherPublicProfile;
  courses: CourseListItem[];
  tests: TestListItem[];
  liveTests: LiveTestListItem[];
  products: ShopProductListItem[];
  // Optional so a profile cached before bundles were added still renders.
  bundles?: TeacherProfileBundle[];
  // Every exam the teacher's published items are listed under, primary and other.
  examNames?: string[];
};

export const getTeachersProfile = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const params = new URLSearchParams({
    teacherSlug: validatedInput.teacherSlug,
  });

  const result = await fetch(`/_api/teachers/profile?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    try {
      const errorObject = superjson.parse<{ error: string }>(
        await result.text()
      );
      throw new Error(errorObject.error);
    } catch (e) {
      throw new Error(`Request failed with status ${result.status}`);
    }
  }

  return superjson.parse<OutputType>(await result.text());
};