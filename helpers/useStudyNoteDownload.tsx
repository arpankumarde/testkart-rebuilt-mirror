import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { postStudentShopDownload } from "../endpoints/student/shop/download_POST.schema";
import { STUDENT_PURCHASES_QUERY_KEY } from "./useShopQuery";

// Asks the server for a short-lived signed link to a purchased note's PDF and hands it to the browser,
// which saves it as an attachment. The server checks the purchase and the note's allow_download flag.
export const useStudyNoteDownload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { productId: number; fileId?: number }) => postStudentShopDownload(input),
    onSuccess: ({ downloadUrl }) => {
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
    onError: (error) => {
      toast.error(error.message || "Could not start the download. Please try again.");
    },
    // A refused request usually means the teacher turned downloads off, so the action is refreshed too.
    onSettled: (_data, _error, { productId }) => {
      queryClient.invalidateQueries({ queryKey: STUDENT_PURCHASES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["studentShopFiles", productId] });
    },
  });
};
