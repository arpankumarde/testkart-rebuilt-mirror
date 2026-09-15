import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getAdminCustomExamNamesList } from "../endpoints/admin/custom-exam-names/list_GET.schema";
import { getAdminCustomExamNameDuplicates } from "../endpoints/admin/custom-exam-names/duplicates_GET.schema";
import {
  postAdminUpdateCustomExamName,
  type InputType as UpdateInputType,
} from "../endpoints/admin/custom-exam-names/update_POST.schema";
import {
  postAdminMakeOfficialCustomExamName,
  type InputType as MakeOfficialInputType,
} from "../endpoints/admin/custom-exam-names/make-official_POST.schema";
import {
  postAdminDeleteCustomExamName,
  type InputType as DeleteInputType,
} from "../endpoints/admin/custom-exam-names/delete_POST.schema";
import {
  postAdminMergeCustomExamNames,
  type InputType as MergeInputType,
} from "../endpoints/admin/custom-exam-names/merge_POST.schema";
import { CUSTOM_EXAM_NAMES_QUERY_KEY } from "./useExamNameSuggestions";

const ADMIN_CUSTOM_EXAM_NAMES_QUERY_KEY = ["admin", "custom-exam-names"];
const ADMIN_CUSTOM_EXAM_NAME_DUPLICATES_QUERY_KEY = ["admin", "custom-exam-names", "duplicates"];
const ADMIN_EXAM_CATEGORIES_QUERY_KEY = ["admin", "exam-categories"];
const ADMIN_EXAMS_QUERY_KEY = ["admin", "exams"];

export const useAdminCustomExamNamesQuery = () => {
  return useQuery({
    queryKey: ADMIN_CUSTOM_EXAM_NAMES_QUERY_KEY,
    queryFn: () => getAdminCustomExamNamesList(),
  });
};

export const useAdminCustomExamNameDuplicatesQuery = () => {
  return useQuery({
    queryKey: ADMIN_CUSTOM_EXAM_NAME_DUPLICATES_QUERY_KEY,
    queryFn: () => getAdminCustomExamNameDuplicates(),
  });
};

export const useUpdateCustomExamNameMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateInputType) => postAdminUpdateCustomExamName(data),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({
        queryKey: ADMIN_CUSTOM_EXAM_NAMES_QUERY_KEY,
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_CUSTOM_EXAM_NAME_DUPLICATES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CUSTOM_EXAM_NAMES_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to update custom name.");
    },
  });
};

export const useMakeOfficialMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MakeOfficialInputType) =>
      postAdminMakeOfficialCustomExamName(data),
    onSuccess: () => {
      toast.success("Exam has been made official successfully.");
      queryClient.invalidateQueries({
        queryKey: ADMIN_CUSTOM_EXAM_NAMES_QUERY_KEY,
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_CUSTOM_EXAM_NAME_DUPLICATES_QUERY_KEY });
      queryClient.invalidateQueries({
        queryKey: ADMIN_EXAM_CATEGORIES_QUERY_KEY,
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CUSTOM_EXAM_NAMES_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        parseErrorMessage(error) || "Failed to make custom name official."
      );
    },
  });
};

export const useDeleteCustomExamNameMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DeleteInputType) => postAdminDeleteCustomExamName(data),
    onSuccess: () => {
      toast.success("Custom exam name removed successfully.");
      queryClient.invalidateQueries({
        queryKey: ADMIN_CUSTOM_EXAM_NAMES_QUERY_KEY,
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_CUSTOM_EXAM_NAME_DUPLICATES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CUSTOM_EXAM_NAMES_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to remove custom name.");
    },
  });
};

export const useMergeCustomExamNamesMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MergeInputType) => postAdminMergeCustomExamNames(data),
    onSuccess: (data) => {
      const total = data.mergedMockTests + data.mergedProducts;
      toast.success(`Merged ${total} item${total === 1 ? "" : "s"} into ${data.targetExam.examName}.`);
      queryClient.invalidateQueries({ queryKey: ADMIN_CUSTOM_EXAM_NAMES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_CUSTOM_EXAM_NAME_DUPLICATES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAM_CATEGORIES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CUSTOM_EXAM_NAMES_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to merge exam names.");
    },
  });
};