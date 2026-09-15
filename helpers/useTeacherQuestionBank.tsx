import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeacherQuestionBankList, InputType as ListInput } from "../endpoints/teacher/question-bank/list_GET.schema";
import { postTeacherQuestionBankCreate, InputType as CreateInput } from "../endpoints/teacher/question-bank/create_POST.schema";
import { postTeacherQuestionBankUpdate, InputType as UpdateInput } from "../endpoints/teacher/question-bank/update_POST.schema";
import { postTeacherQuestionBankDelete, InputType as DeleteInput } from "../endpoints/teacher/question-bank/delete_POST.schema";
import { postTeacherQuestionBankImportToTest, InputType as ImportInput } from "../endpoints/teacher/question-bank/import-to-test_POST.schema";
import { postTeacherQuestionBankSaveFromTest, InputType as SaveInput } from "../endpoints/teacher/question-bank/save-from-test_POST.schema";
import { postTeacherQuestionBankBulkUpload, InputType as BulkUploadInput } from "../endpoints/teacher/question-bank/bulk-upload_POST.schema";

export const TEACHER_QUESTION_BANK_QUERY_KEY = ["teacher", "questionBank"];
export const TEACHER_QUESTIONS_QUERY_KEY_PREFIX = ["teacher", "questions"];

export const useTeacherQuestionBankQuery = (params: ListInput) => {
  return useQuery({
    queryKey: [...TEACHER_QUESTION_BANK_QUERY_KEY, params],
    queryFn: () => getTeacherQuestionBankList(params),
  });
};

export const useCreateBankQuestionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInput) => postTeacherQuestionBankCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_QUESTION_BANK_QUERY_KEY });
    },
  });
};

export const useUpdateBankQuestionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateInput) => postTeacherQuestionBankUpdate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_QUESTION_BANK_QUERY_KEY });
    },
  });
};

export const useDeleteBankQuestionsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DeleteInput) => postTeacherQuestionBankDelete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_QUESTION_BANK_QUERY_KEY });
    },
  });
};

export const useImportToTestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ImportInput) => postTeacherQuestionBankImportToTest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_QUESTIONS_QUERY_KEY_PREFIX });
      queryClient.invalidateQueries({ queryKey: ["teacher", "testItems"] });
    },
  });
};

export const useSaveFromTestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveInput) => postTeacherQuestionBankSaveFromTest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_QUESTION_BANK_QUERY_KEY });
    },
  });
};

export const useBulkUploadBankQuestionsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkUploadInput) => postTeacherQuestionBankBulkUpload(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_QUESTION_BANK_QUERY_KEY });
    },
  });
};