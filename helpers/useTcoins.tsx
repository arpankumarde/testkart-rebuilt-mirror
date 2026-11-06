import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getStudentTcoinsSummary, OutputType as TcoinsSummary } from "../endpoints/student/tcoins/summary_GET.schema";
import { getAdminTcoinsSettings, OutputType as AdminTcoinsSettings } from "../endpoints/admin/settings/tcoins_GET.schema";
import { postAdminTcoinsSettings, InputType as AdminTcoinsInput } from "../endpoints/admin/settings/tcoins_POST.schema";
import { getAdminTcoinGrants } from "../endpoints/admin/settings/tcoins/grants_GET.schema";
import { postAdminTcoinGrant, InputType as AdminTcoinGrantInput } from "../endpoints/admin/settings/tcoins/grants_POST.schema";

export const STUDENT_TCOINS_QUERY_KEY = ["student", "tcoins", "summary"] as const;
const ADMIN_TCOINS_QUERY_KEY = ["admin", "settings", "tcoins"] as const;
const ADMIN_TCOIN_GRANTS_QUERY_KEY = ["admin", "settings", "tcoins", "grants"] as const;

/** Coins move with order status, so this refetches on every mount despite the app-wide no-refetch default. */
export const useStudentTcoins = (enabled = true) =>
  useQuery<TcoinsSummary, Error>({
    queryKey: STUDENT_TCOINS_QUERY_KEY,
    queryFn: () => getStudentTcoinsSummary(),
    enabled,
    refetchOnMount: "always",
  });

export const useAdminTcoinsSettings = () =>
  useQuery<AdminTcoinsSettings, Error>({
    queryKey: ADMIN_TCOINS_QUERY_KEY,
    queryFn: () => getAdminTcoinsSettings(),
    refetchOnMount: "always",
  });

export const useUpdateAdminTcoinsSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminTcoinsInput) => postAdminTcoinsSettings(input),
    onSuccess: () => {
      toast.success("Tcoins settings saved.");
      queryClient.invalidateQueries({ queryKey: ADMIN_TCOINS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: STUDENT_TCOINS_QUERY_KEY });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not save Tcoins settings.");
    },
  });
};

export const useAdminTcoinGrants = () =>
  useQuery({
    queryKey: ADMIN_TCOIN_GRANTS_QUERY_KEY,
    queryFn: () => getAdminTcoinGrants(),
    refetchOnMount: "always",
  });

export const useGrantAdminTcoins = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminTcoinGrantInput) => postAdminTcoinGrant(input),
    onSuccess: ({ grant }) => {
      toast.success(`${grant.coins} Tcoins given to ${grant.studentName || grant.studentEmail || "the student"}.`);
      queryClient.invalidateQueries({ queryKey: ADMIN_TCOINS_QUERY_KEY });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not give Tcoins.");
    },
  });
};