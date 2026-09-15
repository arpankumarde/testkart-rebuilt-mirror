import { useQuery } from "@tanstack/react-query";
import { getAdminAiUsageSummary, type InputType as SummaryInputType } from "../endpoints/admin/ai-usage/summary_GET.schema";
import { getAdminAiUsageByTeacher, type InputType as ByTeacherInputType } from "../endpoints/admin/ai-usage/by-teacher_GET.schema";
import { getAdminAiUsageLogs, type InputType as LogsInputType } from "../endpoints/admin/ai-usage/logs_GET.schema";

export const AI_USAGE_QUERY_KEY = "adminAIUsage";

export const useAIUsageSummary = (params: SummaryInputType) => {
  return useQuery({
    queryKey: [AI_USAGE_QUERY_KEY, "summary", params],
    queryFn: () => getAdminAiUsageSummary(params),
  });
};

export const useAIUsageByTeacher = (params: ByTeacherInputType) => {
  return useQuery({
    queryKey: [AI_USAGE_QUERY_KEY, "by-teacher", params],
    queryFn: () => getAdminAiUsageByTeacher(params),
  });
};

export const useAIUsageLogs = (params: LogsInputType) => {
  return useQuery({
    queryKey: [AI_USAGE_QUERY_KEY, "logs", params],
    queryFn: () => getAdminAiUsageLogs(params),
    refetchInterval: 30000, // keep the recent-attempts log reasonably fresh without hammering the server
  });
};
