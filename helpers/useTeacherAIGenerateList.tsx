import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { postTeacherAIGenerateList, AiGenerateListError } from "../endpoints/teacher/ai/generate-list_POST.schema";

export const useTeacherAIGenerateList = () => {
  return useMutation({
    mutationFn: postTeacherAIGenerateList,
    onError: (error) => {
      console.error("AI Generate List failed:", error);

      // Specifically ignore OUT_OF_CREDITS errors for toasts as per Floot AI guidelines
      if (error instanceof AiGenerateListError && error.code === "OUT_OF_CREDITS") {
        console.log("AI credits exhausted, suppressing toast.");
        return;
      }

      toast.error(error instanceof Error ? error.message : "Failed to generate suggestions");
    },
  });
};
