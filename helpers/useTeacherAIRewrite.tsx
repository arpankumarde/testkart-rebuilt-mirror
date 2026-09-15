import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { postTeacherAIRewrite, AiRewriteError } from "../endpoints/teacher/ai/rewrite_POST.schema";

export const useTeacherAIRewrite = () => {
  return useMutation({
    mutationFn: postTeacherAIRewrite,
    onError: (error) => {
      console.error("AI Rewrite failed:", error);
      
      // Specifically ignore OUT_OF_CREDITS errors for toasts as per Floot AI guidelines
      if (error instanceof AiRewriteError && error.code === "OUT_OF_CREDITS") {
        console.log("AI credits exhausted, suppressing toast.");
        return;
      }
      
      toast.error(error instanceof Error ? error.message : "Failed to generate content");
    },
  });
};