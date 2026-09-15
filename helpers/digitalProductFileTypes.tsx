export type DigitalProductFileItem = {
  id: number;
  title: string;
  fileUrl: string;
  fileId: string | null;
  fileSizeBytes: number | null;
  pageCount: number | null;
  orderIndex: number;
};