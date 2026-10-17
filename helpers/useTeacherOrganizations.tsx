import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeacherOrganizationsMine } from "../endpoints/teacher/organizations/mine_GET.schema";
import {
  postTeacherOrganizationsCreate,
  InputType as CreateOrgInput,
} from "../endpoints/teacher/organizations/create_POST.schema";
import {
  getTeacherOrganizationsSearch,
  InputType as SearchOrgInput,
} from "../endpoints/teacher/organizations/search_GET.schema";
import { postTeacherOrganizationsJoinRequest } from "../endpoints/teacher/organizations/join-request_POST.schema";
import {
  postTeacherOrganizationsRespondRequest,
  InputType as RespondRequestInput,
} from "../endpoints/teacher/organizations/respond-request_POST.schema";
import { postTeacherOrganizationsLeave } from "../endpoints/teacher/organizations/leave_POST.schema";
import {
  postTeacherOrganizationsUpdate,
  InputType as UpdateOrgInput,
} from "../endpoints/teacher/organizations/update_POST.schema";

const MINE_QUERY_KEY = ["teacherOrganizationsMine"] as const;

export const useTeacherOrganizationsMineQuery = () =>
  useQuery({
    queryKey: MINE_QUERY_KEY,
    queryFn: () => getTeacherOrganizationsMine(),
    staleTime: 30 * 1000,
  });

export const useCreateOrganizationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrgInput) => postTeacherOrganizationsCreate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MINE_QUERY_KEY });
    },
  });
};

export const useSearchOrganizationsQuery = (query: SearchOrgInput, enabled: boolean) =>
  useQuery({
    queryKey: ["teacherOrganizationsSearch", query.q],
    queryFn: () => getTeacherOrganizationsSearch(query),
    enabled,
    staleTime: 15 * 1000,
  });

export const useJoinRequestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: string) => postTeacherOrganizationsJoinRequest({ organizationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MINE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["teacherOrganizationsSearch"] });
    },
  });
};

export const useRespondRequestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RespondRequestInput) => postTeacherOrganizationsRespondRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MINE_QUERY_KEY });
    },
  });
};

export const useLeaveOrganizationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: string) => postTeacherOrganizationsLeave({ organizationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MINE_QUERY_KEY });
    },
  });
};

export const useUpdateOrganizationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOrgInput) => postTeacherOrganizationsUpdate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MINE_QUERY_KEY });
    },
  });
};
