import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { postTeacherAIGenerateAll, AiGenerateAllError } from "../endpoints/teacher/ai/generate-all_POST.schema";

export const useTeacherAIGenerateAll = () => {
  return useMutation({
    mutationFn: postTeacherAIGenerateAll,
    onError: (error) => {
      console.error("AI Generate All failed:", error);
      
      // Specifically ignore OUT_OF_CREDITS errors for toasts as per Floot AI guidelines
      if (error instanceof AiGenerateAllError && error.code === "OUT_OF_CREDITS") {
        console.log("AI credits exhausted, suppressing toast.");
        return;
      }
      
      toast.error(error instanceof Error ? error.message : "Failed to generate content");
    },
  });
};