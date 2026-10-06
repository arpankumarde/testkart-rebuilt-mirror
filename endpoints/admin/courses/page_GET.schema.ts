import { z } from "zod";
import { CourseStatus } from "../../../helpers/schema";
import {
  catalogueListBaseSchema,
  CatalogueListPage,
  fetchCatalogueListPage,
} from "../../../helpers/adminCatalogueList";

export const COURSE_SORT_COLUMNS = ["title", "status", "students", "price", "createdAt"] as const;
export type CourseSortColumn = (typeof COURSE_SORT_COLUMNS)[number];

export const schema = catalogueListBaseSchema.extend({
  status: z.enum(["published", "draft", "archived"]).optional(),
  /* Dashboard subset: courses with no lessons. */
  filter: z.enum(["no-lessons"]).optional(),
  sortBy: z.enum(COURSE_SORT_COLUMNS).optional(),
});

export type InputType = z.input<typeof schema>;

export type AdminCoursePageItem = {
  id: number;
  title: string;
  slug: string;
  status: CourseStatus;
  createdAt: Date | null;
  price: number;
  teacherName: string;
  studentsEnrolled: number;
  lessonsCount: number;
};

export type OutputType = CatalogueListPage<AdminCoursePageItem, CourseStatus>;

export const getAdminCoursesPage = (input: InputType, init?: RequestInit): Promise<OutputType> =>
  fetchCatalogueListPage<OutputType>("/_api/admin/courses/page", input, init);