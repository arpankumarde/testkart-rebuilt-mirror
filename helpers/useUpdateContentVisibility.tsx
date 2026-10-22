import { useMutation, useQueryClient, type Query } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  postTeacherContentVisibilityUpdate,
  type InputType,
} from "../endpoints/teacher/content-visibility/update_POST.schema";
import { parseErrorMessage } from "./parseErrorMessage";

// Every teacher console query key starts with "teacher" ("teacher", "teacherLiveTests").
const isTeacherQuery = (query: Query) =>
  typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("teacher");

export const useUpdateContentVisibility = () => {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.removeQueries({ predicate: isTeacherQuery, type: "inactive" });
    return queryClient.invalidateQueries({ predicate: isTeacherQuery });
  };
  return useMutation({
    mutationFn: (input: InputType) => postTeacherContentVisibilityUpdate(input),
    // Returning the refresh keeps the mutation pending until the panel shows the new status.
    onSuccess: (data) => {
      if (data.alreadyInReview) toast.info(data.title, { description: data.message });
      else toast.success(data.title, { description: data.message });
      return refresh();
    },
    onError: (error: unknown) => {
      toast.error("Could not change visibility", { description: parseErrorMessage(error) });
      return refresh();
    },
  });
};