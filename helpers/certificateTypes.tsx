import { CertificateType } from "./schema";

export type CertificateData = {
  studentName: string;
  itemName: string;
  teacherName: string;
  completionDate: string; // ISO string format for JSON storage
  certificateNumber: string;
} & (
  | { type: "course_completion"; score?: never }
  | { type: "test_completion"; score: number }
);