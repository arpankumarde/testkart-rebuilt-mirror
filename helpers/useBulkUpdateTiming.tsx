import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  postBulkUpdateTiming,
  InputType,
  OutputType,
} from "../endpoints/teacher/questions/bulk-update-timing_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";

export const useBulkUpdateTiming = () => {
  const queryClient = useQueryClient();

  return useMutation<OutputType, Error, InputType>({
    mutationFn: async (data) => {
      return await postBulkUpdateTiming(data);
    },
    onSuccess: (data) => {
      toast.success(`Successfully updated timing for ${data.updatedCount} questions.`);
      // Invalidate relevant queries like test questions listing
      queryClient.invalidateQueries({ queryKey: ["testQuestions"] });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to update timing");
    },
  });
};