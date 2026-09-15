import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { ADMIN_EXAM_DASHBOARD_QUERY_KEY } from "./useAdminExamDashboard";
import {
  getAdminExamCategories,
  type ExamCategoryWithExams,
} from "../endpoints/admin/exam-categories/list_GET.schema";
import {
  postAdminCreateExamCategory,
  type InputType as CreateCategoryInput,
} from "../endpoints/admin/exam-categories/create_POST.schema";
import {
  postAdminUpdateExamCategory,
  type InputType as UpdateCategoryInput,
} from "../endpoints/admin/exam-categories/update_POST.schema";
import {
  postAdminDeleteExamCategory,
  type InputType as DeleteCategoryInput,
} from "../endpoints/admin/exam-categories/delete_POST.schema";
import {
  getAdminExams,
  type InputType as GetExamsInput,
} from "../endpoints/admin/exams/list_GET.schema";
import {
  postAdminCreateExam,
  type InputType as CreateExamInput,
} from "../endpoints/admin/exams/create_POST.schema";
import {
  postAdminUpdateExam,
  type InputType as UpdateExamInput,
} from "../endpoints/admin/exams/update_POST.schema";
import {
  postAdminDeleteExam,
  type InputType as DeleteExamInput,
} from "../endpoints/admin/exams/delete_POST.schema";

const ADMIN_EXAM_CATEGORIES_QUERY_KEY = ["admin", "exam-categories"];
const ADMIN_EXAMS_QUERY_KEY = ["admin", "exams"];

// Exam Categories Hooks
export const useAdminExamCategoriesQuery = () => {
  return useQuery({
    queryKey: ADMIN_EXAM_CATEGORIES_QUERY_KEY,
    queryFn: () => getAdminExamCategories(),
  });
};

export const useCreateExamCategoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryInput) =>
      postAdminCreateExamCategory(data),
    onSuccess: () => {
      toast.success("Exam category created successfully.");
      queryClient.invalidateQueries({
        queryKey: ADMIN_EXAM_CATEGORIES_QUERY_KEY,
      });
    },
    onError: (error) => {
      toast.error(
        parseErrorMessage(error) ||  "Failed to create category."
      );
    },
  });
};

export const useUpdateExamCategoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateCategoryInput) =>
      postAdminUpdateExamCategory(data),
    onSuccess: () => {
      toast.success("Exam category updated successfully.");
      queryClient.invalidateQueries({
        queryKey: ADMIN_EXAM_CATEGORIES_QUERY_KEY,
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAM_DASHBOARD_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        parseErrorMessage(error) ||  "Failed to update category."
      );
    },
  });
};

export const useDeleteExamCategoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DeleteCategoryInput) =>
      postAdminDeleteExamCategory(data),
    onSuccess: () => {
      toast.success("Exam category deleted successfully.");
      queryClient.invalidateQueries({
        queryKey: ADMIN_EXAM_CATEGORIES_QUERY_KEY,
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAM_DASHBOARD_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        parseErrorMessage(error) ||  "Failed to delete category."
      );
    },
  });
};

// Exams Hooks
export const useAdminExamsQuery = (params?: GetExamsInput) => {
  return useQuery({
    queryKey: [...ADMIN_EXAMS_QUERY_KEY, params],
    queryFn: () => getAdminExams(params),
  });
};

export const useCreateExamMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExamInput) => postAdminCreateExam(data),
    onSuccess: () => {
      toast.success("Exam created successfully.");
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAMS_QUERY_KEY });
      queryClient.invalidateQueries({
        queryKey: ADMIN_EXAM_CATEGORIES_QUERY_KEY,
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAM_DASHBOARD_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        parseErrorMessage(error) ||  "Failed to create exam."
      );
    },
  });
};

export const useUpdateExamMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateExamInput) => postAdminUpdateExam(data),
    onSuccess: () => {
      toast.success("Exam updated successfully.");
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAMS_QUERY_KEY });
      queryClient.invalidateQueries({
        queryKey: ADMIN_EXAM_CATEGORIES_QUERY_KEY,
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAM_DASHBOARD_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        parseErrorMessage(error) ||  "Failed to update exam."
      );
    },
  });
};

export const useDeleteExamMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DeleteExamInput) => postAdminDeleteExam(data),
    onSuccess: () => {
      toast.success("Exam deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAMS_QUERY_KEY });
      queryClient.invalidateQueries({
        queryKey: ADMIN_EXAM_CATEGORIES_QUERY_KEY,
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAM_DASHBOARD_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        parseErrorMessage(error) ||  "Failed to delete exam."
      );
    },
  });
};