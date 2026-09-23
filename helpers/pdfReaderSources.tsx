import type { PdfReaderSource } from "../components/PdfReader";

export const isImageUrl = (url: string): boolean => {
  const cleanUrl = url.toLowerCase().split("?")[0].split("#")[0];
  return [".jpg", ".jpeg", ".png", ".gif", ".webp"].some((extension) => cleanUrl.endsWith(extension));
};

// Lessons typed as PDF sometimes hold a single image, which the reader shows as a one-page document.
export const documentSource = (url: string): PdfReaderSource =>
  isImageUrl(url)
    ? {
        kind: "images",
        cacheKey: ["reader", "image", url],
        pageCount: 1,
        loadPage: async () => ({ imageUrl: url }),
      }
    : { kind: "pdf", url };
