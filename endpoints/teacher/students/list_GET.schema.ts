import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type ItemType = 'test' | 'course' | 'live_test' | 'bundle' | 'product';
export type EnrollmentType = 'paid' | 'free';

export type TeacherStudent = {
  studentId: number;
  studentName: string;
  studentEmail: string | null;
  studentMobile: string | null;
  itemId: number;
  itemTitle: string;
  itemType: ItemType;
  enrolledAt: Date;
  amountPaid: number;
  enrollmentType: EnrollmentType;
  orderStatus: string | null;
};

export type OutputType = TeacherStudent[];

export const getTeacherStudentsList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/students/list`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};