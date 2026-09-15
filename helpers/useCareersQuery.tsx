import { useQuery, useMutation } from "@tanstack/react-query";
import { getCareersList } from "../endpoints/careers/list_GET.schema";
import { getCareerDetails } from "../endpoints/careers/details_GET.schema";
import { postCareerApply, InputType as ApplyInputType } from "../endpoints/careers/apply_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";

export const PUBLIC_CAREERS_LIST_QUERY_KEY = ["careers", "list"] as const;

export const useCareersListQuery = () => {
  return useQuery({
    queryKey: PUBLIC_CAREERS_LIST_QUERY_KEY,
    queryFn: () => getCareersList(),
  });
};

export const useCareerDetailsQuery = (slug: string) => {
  return useQuery({
    queryKey: ["careers", "details", slug] as const,
    queryFn: () => getCareerDetails({ slug }),
    enabled: !!slug,
  });
};

export const useApplyMutation = () => {
  return useMutation({
    mutationFn: (data: ApplyInputType) => postCareerApply(data),
    onSuccess: () => {
      toast.success("Application submitted! We'll be in touch soon.");
    },
    onError: (error) => {
      toast.error(
        parseErrorMessage(error) ||  "Failed to submit application"
      );
    },
  });
};