import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import {
  CourseBundles,
  BundleEnrollments,
  Users,
  Courses,
  CourseEnrollments,
  MockTests,
  DigitalProducts } from
'../../../helpers/schema';

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

type EnrolledCourseInBundle = Pick<Selectable<Courses>, "id" | "title" | "slug"> &
Partial<
  Pick<
    Selectable<CourseEnrollments>,
    "completionPercentage" | "lastAccessedAt">>;

export type EnrolledMockTestInBundle = Pick<
  Selectable<MockTests>,
  "id" | "title" | "slug"> & {
  isEnrolled: boolean;
};

export type EnrolledDigitalProductInBundle = Pick<
  Selectable<DigitalProducts>,
  "id" | "title" | "slug"> & {
  isPurchased: boolean;
};

export type EnrolledBundle = Pick<
  Selectable<CourseBundles>,
  "id" | "title" | "slug" | "thumbnailUrl"> &

Pick<Selectable<BundleEnrollments>, "enrolledAt"> & {
  teacherName: Selectable<Users>["displayName"];
  courses: EnrolledCourseInBundle[];
  mockTests: EnrolledMockTestInBundle[];
  digitalProducts: EnrolledDigitalProductInBundle[];
};

export type OutputType = {
  enrolledBundles: EnrolledBundle[];
};

export const getStudentEnrolledBundles = async (
init?: RequestInit)
: Promise<OutputType> => {
  const result = await fetch(`/_api/student/bundles/enrolled`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{error: string;}>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};