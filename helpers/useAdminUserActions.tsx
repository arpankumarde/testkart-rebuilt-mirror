import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { postAdminAccountStatus } from "../endpoints/admin/user/account-status_POST.schema";
import { ADMIN_TEACHERS_QUERY_KEY } from "./useAdminTeachers";
import { ADMIN_STUDENTS_QUERY_KEY } from "./useAdminStudents";

const SUCCESS_TEXT = {
  active: "Account reactivated.",
  suspended: "Account suspended and signed out everywhere.",
  banned: "Account banned and signed out everywhere.",
} as const;

export const useAccountStatusMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postAdminAccountStatus,
    onSuccess: (data, variables) => {
      const emailNote =
        variables.action === "reactivate" && !data.emailSent
          ? ""
          : data.emailSent
            ? " The user has been emailed."
            : " No email went out: the account has no email address, or sending failed.";
      toast.success(`${SUCCESS_TEXT[data.status]}${emailNote}`);
      queryClient.invalidateQueries({ queryKey: [ADMIN_TEACHERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_STUDENTS_QUERY_KEY] });
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(`Could not change the account: ${parseErrorMessage(error)}`);
      } else {
        toast.error("Could not change the account.");
      }
    },
  });
};