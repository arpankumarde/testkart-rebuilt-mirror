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
    queryClient.invalidateQueries({ predicate: isTeacherQuery });
  };
  return useMutation({
    mutationFn: (input: InputType) => postTeacherContentVisibilityUpdate(input),
    onSuccess: (data) => {
      toast.success(data.inReview ? "Submitted for review" : "Visibility updated", { description: data.message });
      refresh();
    },
    onError: (error: unknown) => {
      toast.error("Could not change visibility", { description: parseErrorMessage(error) });
      refresh();
    },
  });
};