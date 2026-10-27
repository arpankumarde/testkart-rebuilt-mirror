import { useMutation } from "@tanstack/react-query";
import { postTeacherAIGenerateAll } from "../endpoints/teacher/ai/generate-all_POST.schema";

// Errors are shown inline under the prompt by AIContentPrompt, so no toast here.
export const useTeacherAIGenerateAll = () => {
  return useMutation({
    mutationFn: postTeacherAIGenerateAll,
    onError: (error) => {
      console.error("AI Generate All failed:", error);
    },
  });
};