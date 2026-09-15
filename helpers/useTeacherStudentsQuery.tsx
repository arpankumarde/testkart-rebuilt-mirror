import { useQuery } from "@tanstack/react-query";
import { getTeacherStudentsList } from "../endpoints/teacher/students/list_GET.schema";

export const TEACHER_STUDENTS_QUERY_KEY = ["teacher", "students"];

export const useTeacherStudentsQuery = () => {
  return useQuery({
    queryKey: TEACHER_STUDENTS_QUERY_KEY,
    queryFn: () => getTeacherStudentsList(),
    staleTime: 15 * 60 * 1000,
  });
};