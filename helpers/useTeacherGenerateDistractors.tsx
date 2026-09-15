import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  postTeacherGenerateDistractors,
  GenerateDistractorsError,
} from "../endpoints/teacher/ai/generate-distractors_POST.schema";

export const useTeacherGenerateDistractors = () => {
  return useMutation({
    mutationFn: postTeacherGenerateDistractors,
    onError: (error) => {
      console.error("AI Generate Distractors failed:", error);

      if (error instanceof GenerateDistractorsError && error.code === "OUT_OF_CREDITS") {
        console.log("AI credits exhausted, suppressing toast.");
        return;
      }

      toast.error(error instanceof Error ? error.message : "Failed to generate distractors");
    },
  });
};
