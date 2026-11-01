import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAdminGecList, type InputType as ListInput } from "../endpoints/admin/govt-exams-calendar/list_GET.schema";
import { getAdminGecExam } from "../endpoints/admin/govt-exams-calendar/exam_GET.schema";
import { postAdminGecExamSave } from "../endpoints/admin/govt-exams-calendar/exam-save_POST.schema";
import { postAdminGecExamDelete } from "../endpoints/admin/govt-exams-calendar/exam-delete_POST.schema";
import { postAdminGecVerify, type InputType as VerifyInput } from "../endpoints/admin/govt-exams-calendar/exam-verify_POST.schema";
import { postAdminGecVisibility, type InputType as VisibilityInput } from "../endpoints/admin/govt-exams-calendar/exam-visibility_POST.schema";
import { postAdminGecExtendDeadline, type InputType as ExtendInput } from "../endpoints/admin/govt-exams-calendar/deadline-extend_POST.schema";
import { getAdminGecContent } from "../endpoints/admin/govt-exams-calendar/content_GET.schema";
import { postAdminGecContentSave, type InputType as ContentSaveInput } from "../endpoints/admin/govt-exams-calendar/content-save_POST.schema";
import { getAdminGecDraft } from "../endpoints/admin/govt-exams-calendar/draft_GET.schema";
import { getAdminGecMeta } from "../endpoints/admin/govt-exams-calendar/meta_GET.schema";
import { postAdminGecPublish, type InputType as PublishInput } from "../endpoints/admin/govt-exams-calendar/publish_POST.schema";
import { getAdminGecLog, type InputType as LogInput } from "../endpoints/admin/govt-exams-calendar/log_GET.schema";
import { postAdminGecLogAdd, type InputType as LogAddInput } from "../endpoints/admin/govt-exams-calendar/log-add_POST.schema";
import { postAdminGecLogDelete } from "../endpoints/admin/govt-exams-calendar/log-delete_POST.schema";
import { getAdminGecTestkartExams } from "../endpoints/admin/govt-exams-calendar/testkart-exams_GET.schema";
import { getAdminGecTestkartPages } from "../endpoints/admin/govt-exams-calendar/testkart-pages_GET.schema";
import { getAdminGecNewsPosts } from "../endpoints/admin/govt-exams-calendar/news-posts_GET.schema";
import { postAdminGecImport, type InputType as ImportInput } from "../endpoints/admin/govt-exams-calendar/import_POST.schema";
import type { GecExamInput } from "./gecExamInput";
import { GEC_PUBLIC_QUERY_KEY } from "./useGovtExamsCalendar";
import { parseErrorMessage } from "./parseErrorMessage";

export const ADMIN_GEC_KEY = ["admin", "gec"] as const;

/** Every draft write changes the record list, the preview draft, the pending count and the log. */
const refreshDraft = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ADMIN_GEC_KEY });
};

export const useAdminGecList = (input: ListInput) =>
  useQuery({
    queryKey: [...ADMIN_GEC_KEY, "list", input],
    queryFn: () => getAdminGecList(input),
    placeholderData: (previous) => previous,
  });

export const useAdminGecExam = (id: number | null) =>
  useQuery({
    queryKey: [...ADMIN_GEC_KEY, "exam", id],
    queryFn: () => getAdminGecExam({ id: id! }),
    enabled: id !== null,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

export const useAdminGecContent = () =>
  useQuery({
    queryKey: [...ADMIN_GEC_KEY, "content"],
    queryFn: () => getAdminGecContent(),
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

export const useAdminGecDraft = () =>
  useQuery({
    queryKey: [...ADMIN_GEC_KEY, "draft"],
    queryFn: () => getAdminGecDraft(),
    refetchOnMount: "always",
  });

export const useAdminGecMeta = () =>
  useQuery({
    queryKey: [...ADMIN_GEC_KEY, "meta"],
    queryFn: () => getAdminGecMeta(),
  });

export const useAdminGecLog = (input: LogInput) =>
  useQuery({
    queryKey: [...ADMIN_GEC_KEY, "log", input],
    queryFn: () => getAdminGecLog(input),
    placeholderData: (previous) => previous,
  });

export const useAdminGecTestkartExams = (q: string) =>
  useQuery({
    queryKey: [...ADMIN_GEC_KEY, "testkart-exams", q],
    queryFn: () => getAdminGecTestkartExams({ q }),
    enabled: q.trim().length >= 2,
    placeholderData: (previous) => previous,
    staleTime: 5 * 60_000,
  });

export const useAdminGecTestkartPages = (examId: number | null) =>
  useQuery({
    queryKey: [...ADMIN_GEC_KEY, "testkart-pages", examId],
    queryFn: () => getAdminGecTestkartPages({ examId: examId! }),
    enabled: examId !== null,
    staleTime: 5 * 60_000,
  });

/** Published Exam News articles for the picker: matches for `q`, or suggestions for the linked Testkart exam. */
export const useAdminGecNewsPosts = (q: string, examId: number | null, enabled: boolean) =>
  useQuery({
    queryKey: [...ADMIN_GEC_KEY, "news-posts", q, examId],
    queryFn: () => getAdminGecNewsPosts({ q: q.trim() || undefined, examId: examId ?? undefined }),
    enabled: enabled && (q.trim().length >= 2 || examId !== null),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });

/** Field errors are left to the editor, which maps them onto its inputs. */
export const useSaveGecExam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GecExamInput) => postAdminGecExamSave(input),
    onSuccess: ({ exam }) => {
      queryClient.setQueryData([...ADMIN_GEC_KEY, "exam", exam.id], { exam });
      refreshDraft(queryClient);
    },
  });
};

export const useDeleteGecExam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => postAdminGecExamDelete({ id }),
    onSuccess: () => {
      toast.success("Record deleted. Publish to remove it from the public page.");
      refreshDraft(queryClient);
    },
    onError: (error) => toast.error(parseErrorMessage(error)),
  });
};

export const useVerifyGecExams = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VerifyInput) => postAdminGecVerify(input),
    onSuccess: (_result, input) => {
      toast.success(input.verification === "verified" ? "Marked as verified" : "Verification updated");
      refreshDraft(queryClient);
    },
    onError: (error) => toast.error(parseErrorMessage(error)),
  });
};

export const useGecVisibility = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VisibilityInput) => postAdminGecVisibility(input),
    onSuccess: (_result, input) => {
      toast.success(input.hidden ? "Hidden from the page after the next publish" : "Shown on the page after the next publish");
      refreshDraft(queryClient);
    },
    onError: (error) => toast.error(parseErrorMessage(error)),
  });
};

export const useExtendGecDeadline = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExtendInput) => postAdminGecExtendDeadline(input),
    onSuccess: () => {
      toast.success("Last date extended. Publish to update the public page.");
      refreshDraft(queryClient);
    },
  });
};

export const useSaveGecContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ContentSaveInput) => postAdminGecContentSave(input),
    onSuccess: (result) => {
      queryClient.setQueryData([...ADMIN_GEC_KEY, "content"], result);
      queryClient.invalidateQueries({ queryKey: [...ADMIN_GEC_KEY, "meta"] });
      queryClient.invalidateQueries({ queryKey: [...ADMIN_GEC_KEY, "draft"] });
      queryClient.invalidateQueries({ queryKey: [...ADMIN_GEC_KEY, "log"] });
      queryClient.invalidateQueries({ queryKey: [...ADMIN_GEC_KEY, "list"] });
    },
  });
};

export const usePublishGec = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PublishInput) => postAdminGecPublish(input),
    onSuccess: () => {
      toast.success("Published. The public page shows these changes within a few minutes.");
      refreshDraft(queryClient);
      queryClient.invalidateQueries({ queryKey: GEC_PUBLIC_QUERY_KEY });
    },
  });
};

export const useAddGecLogNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LogAddInput) => postAdminGecLogAdd(input),
    onSuccess: (_result, input) => {
      toast.success(input.isPublic ? "Note added. It appears on the page after the next publish." : "Note added");
      refreshDraft(queryClient);
    },
    onError: (error) => toast.error(parseErrorMessage(error)),
  });
};

export const useDeleteGecLogNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => postAdminGecLogDelete({ id }),
    onSuccess: () => {
      toast.success("Note deleted");
      refreshDraft(queryClient);
    },
    onError: (error) => toast.error(parseErrorMessage(error)),
  });
};

export const useImportGec = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportInput) => postAdminGecImport(input),
    onSuccess: (result) => {
      if (!result.dryRun) refreshDraft(queryClient);
    },
  });
};
