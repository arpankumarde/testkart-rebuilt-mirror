import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { postTeacherProductsAnalyzePdf } from "../endpoints/teacher/products/analyze-pdf_POST.schema";

export const useTeacherProductAnalyzePdf = () => {
  return useMutation({
    mutationFn: postTeacherProductsAnalyzePdf,
    onError: (error) => {
      console.error("AI PDF analysis failed:", error);
      toast.error(error instanceof Error ? error.message : "Couldn't analyze the PDF");
    },
  });
};
