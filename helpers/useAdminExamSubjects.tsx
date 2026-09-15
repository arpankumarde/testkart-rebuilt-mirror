import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getAdminExamSubjects } from "../endpoints/admin/exam-subjects/list_GET.schema";
import {
  postAdminCreateExamSubject,
  type InputType as CreateInputType,
} from "../endpoints/admin/exam-subjects/create_POST.schema";
import {
  postAdminUpdateExamSubject,
  type InputType as UpdateInputType,
} from "../endpoints/admin/exam-subjects/update_POST.schema";
import {
  postAdminDeleteExamSubject,
  type InputType as DeleteInputType,
} from "../endpoints/admin/exam-subjects/delete_POST.schema";

export const examSubjectsQueryKey = (examId: number) => [
  "admin",
  "examSubjects",
  examId,
];

/**
 * Query to fetch subjects for a specific exam.
 * @param examId The ID of the exam.
 */
export const useExamSubjectsQuery = (examId: number) => {
  return useQuery({
    queryKey: examSubjectsQueryKey(examId),
    queryFn: () => getAdminExamSubjects({ examId }),
    enabled: !isNaN(examId) && examId > 0,
  });
};

/**
 * Mutation to create a new exam subject.
 * Invalidates the exam subjects query for the parent exam on success.
 */
export const useCreateExamSubjectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subjectData: CreateInputType) =>
      postAdminCreateExamSubject(subjectData),
    onSuccess: (data, variables) => {
      toast.success("Subject created successfully!");
      queryClient.invalidateQueries({
        queryKey: examSubjectsQueryKey(variables.examId),
      });
    },
    onError: (error) => {
      console.error("Error creating exam subject:", error);
      toast.error(
        parseErrorMessage(error) ||  "Failed to create subject"
      );
    },
  });
};

/**
 * Mutation to update an existing exam subject.
 * Invalidates the exam subjects query for the parent exam on success.
 */
export const useUpdateExamSubjectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subjectData: UpdateInputType) =>
      postAdminUpdateExamSubject(subjectData),
    onSuccess: (data) => {
      toast.success("Subject updated successfully!");
      queryClient.invalidateQueries({
        queryKey: examSubjectsQueryKey(data.subject.examId),
      });
    },
    onError: (error) => {
      console.error("Error updating exam subject:", error);
      toast.error(
        parseErrorMessage(error) ||  "Failed to update subject"
      );
    },
  });
};

/**
 * Mutation to delete an exam subject.
 * Invalidates the exam subjects query for the parent exam on success.
 */
export const useDeleteExamSubjectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: DeleteInputType & { examId: number }) =>
      postAdminDeleteExamSubject({ id: variables.id }),
    onSuccess: (data, variables) => {
      toast.success(data.message);
      queryClient.invalidateQueries({
        queryKey: examSubjectsQueryKey(variables.examId),
      });
    },
    onError: (error) => {
      console.error("Error deleting exam subject:", error);
      toast.error(
        parseErrorMessage(error) ||  "Failed to delete subject"
      );
    },
  });
};