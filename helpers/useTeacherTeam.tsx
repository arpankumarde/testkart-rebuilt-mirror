import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeacherTeamList } from "../endpoints/teacher/team/list_GET.schema";
import { postTeacherTeamInvite } from "../endpoints/teacher/team/invite_POST.schema";
import { postTeacherTeamRemove } from "../endpoints/teacher/team/remove_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacherTeam"] });
      toast.success("Team member invited successfully!");
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
      toast.success("Team member removed successfully.");
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to remove team member.");
    }
  });
};