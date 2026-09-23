import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { PdfReaderPage } from "../components/PdfReaderPage";
import { useSignedShopPdfUrl } from "../helpers/useSignedShopPdfUrl";

const toId = (value: string | null | undefined): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = parseInt(value, 10);
  return id > 0 ? id : null;
};

export default function StudentShopReadPage() {
  const { productId: productIdParam } = useParams<{ productId: string }>();
  const [searchParams] = useSearchParams();

  const productId = toId(productIdParam);
  const fileParam = searchParams.get("file");
  const fileId = toId(fileParam);
  const isLinkValid = productId !== null && (fileParam === null || fileId !== null);

  const { signedUrl, title, isLoading, error, refetch } = useSignedShopPdfUrl({
    productId: isLinkValid ? productId : null,
    fileId,
    enabled: isLinkValid,
  });

  let message: string | null = null;
  if (!isLinkValid) {
    message = "This link is not valid. Open the file again from your study notes.";
  } else if (error) {
    message = "This file could not be opened. Check that you are signed in to the account that bought it, then try again.";
  }

  return (
    <PdfReaderPage
      title={title ?? "Study notes"}
      note="Read only"
      source={signedUrl ? { kind: "pdf", url: signedUrl } : null}
      loading={isLinkValid && isLoading}
      error={message}
      onRetry={isLinkValid ? refetch : undefined}
      restricted
    />
  );
}
