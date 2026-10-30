export type DigitalProductFileItem = {
  id: number;
  title: string;
  fileUrl: string;
  fileId: string | null;
  fileSizeBytes: number | null;
  pageCount: number | null;
  orderIndex: number;
  /** Students can open this file's first previewPages pages for free. */
  previewEnabled: boolean;
  /** Free preview page count; null when the preview is off. */
  previewPages: number | null;
};
