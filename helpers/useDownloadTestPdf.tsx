import { useMutation } from "@tanstack/react-query";
import { getTeacherTestItemDownloadPdf } from "../endpoints/teacher/test-item/download-pdf_GET.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";

type DownloadTestPdfParams = {
  testItemId: number;
  subjectId?: number;
  fileNameHint?: string;
};

export const useDownloadTestPdf = () => {
  return useMutation({
    mutationFn: async ({ testItemId, subjectId, fileNameHint }: DownloadTestPdfParams) => {
      const blob = await getTeacherTestItemDownloadPdf({ testItemId, subjectId });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameHint
        ? `${fileNameHint}.pdf`
        : subjectId != null
        ? `test-item-${testItemId}-subject-${subjectId}.pdf`
        : `test-item-${testItemId}.pdf`;
      document.body.appendChild(a);

      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to download PDF");
    }
  });
};