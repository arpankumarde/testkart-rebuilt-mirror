import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeacherTeamList } from "../endpoints/teacher/team/list_GET.schema";
import { postTeacherTeamInvite } from "../endpoints/teacher/team/invite_POST.schema";
import { postTeacherTeamRemove } from "../endpoints/teacher/team/remove_POST.schema";
import { getTeacherTeamMe } from "../endpoints/teacher/team/me_GET.schema";
import { postTeacherTeamRespond } from "../endpoints/teacher/team/respond_POST.schema";
import { postTeacherTeamLeave } from "../endpoints/teacher/team/leave_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";

const TEAM_ME_QUERY_KEY = ["teacherTeamMe"];

// Joining or leaving a team switches which academy every teacher page shows, so
// the whole app reloads on the dashboard instead of patching cached queries.
const reloadOnDashboard = () => window.location.assign("/teacher/dashboard");

export const useTeacherTeamQuery = () => {
  return useQuery({
    queryKey: ["teacherTeam"],
    queryFn: () => getTeacherTeamList(),
    staleTime: 15 * 60 * 1000,
  });
};

export const useInviteTeamMemberMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postTeacherTeamInvite,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["teacherTeam"] });
      toast.success(
        result.status === "pending"
          ? "Invite sent. They need to accept it from their Testkart teacher dashboard."
          : "Manager added. They can sign in with Mobile OTP on that number now."
      );
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to invite team member.");
    }
  });
};

export const useRemoveTeamMemberMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postTeacherTeamRemove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacherTeam"] });
      toast.success("Team member removed.");
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to remove team member.");
    }
  });
};

/** The signed-in teacher's own team status: the academy they manage and invitations waiting for them. */
export const useMyTeamQuery = (enabled = true) => {
  return useQuery({
    queryKey: TEAM_ME_QUERY_KEY,
    queryFn: () => getTeacherTeamMe(),
    enabled,
    staleTime: 60 * 1000,
    refetchOnMount: true,
  });
};

export const useRespondToTeamInviteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postTeacherTeamRespond,
    onSuccess: (_result, variables) => {
      if (variables.accept) {
        reloadOnDashboard();
        return;
      }
      queryClient.invalidateQueries({ queryKey: TEAM_ME_QUERY_KEY });
      toast.success("Invitation declined.");
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Could not answer the invitation.");
    }
  });
};

export const useLeaveTeamMutation = () => {
  return useMutation({
    mutationFn: () => postTeacherTeamLeave(),
    onSuccess: reloadOnDashboard,
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Could not leave the team.");
    }
  });
};
