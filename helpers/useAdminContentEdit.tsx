import { createContext, useContext } from "react";
import type { AdminEditType } from "./adminContentEdit";

export interface AdminContentEditState {
  type: AdminEditType;
  id: number;
  teacherName: string;
  /** Where Cancel and a finished save go instead of the teacher console. */
  exitTo: string;
}

export const AdminContentEditContext = createContext<AdminContentEditState | null>(null);

/** Set while a teacher editor is mounted inside the admin panel; null in the teacher console. */
export const useAdminContentEdit = () => useContext(AdminContentEditContext);