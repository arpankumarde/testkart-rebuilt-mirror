import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { CONTENT_REPORT_STATUS_LABELS } from "./contentReportTypes";
import { ADMIN_OVERVIEW_QUERY_KEY } from "./useAdminDashboardOverview";
import { getAdminContentReports, type InputType as ListInput } from "../endpoints/admin/content-reports/list_GET.schema";
import { getAdminContentReportReporter } from "../endpoints/admin/content-reports/reporter_GET.schema";
import {
  postAdminUpdateContentReport,
  type InputType as UpdateInput,
} from "../endpoints/admin/content-reports/update_POST.schema";

export const ADMIN_CONTENT_REPORTS_QUERY_KEY = "adminContentReports" as const;

export const useAdminContentReportsQuery = (params: ListInput) =>
  useQuery({
    queryKey: [ADMIN_CONTENT_REPORTS_QUERY_KEY, params],
    queryFn: () => getAdminContentReports(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });

/** Loaded only when a report is opened, so reporter IPs never ride along with the list. */
export const useAdminContentReportReporterQuery = (id: number | null) =>
  useQuery({
    queryKey: [ADMIN_CONTENT_REPORTS_QUERY_KEY, "reporter", id],
    queryFn: () => getAdminContentReportReporter({ id: id! }),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
  });

export const useUpdateContentReportMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateInput) => postAdminUpdateContentReport(data),
    onSuccess: (result, variables) => {
      toast.success(
        variables.status ? `Report marked ${CONTENT_REPORT_STATUS_LABELS[result.status]}` : "Internal notes saved"
      );
      queryClient.invalidateQueries({ queryKey: [ADMIN_CONTENT_REPORTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ADMIN_OVERVIEW_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Could not update the report.");
    },
  });
};