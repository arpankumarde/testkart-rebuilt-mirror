import { z } from "zod";

export const schema = z.object({
  days: z.coerce.number().int().refine((value) => [7, 30, 90].includes(value)).default(30),
});

export type InputType = z.input<typeof schema>;

/** The endpoint answers text/csv, one row per day. */
export type OutputType = string;

/** Fetches the CSV and saves it in the browser. */
export const downloadAdminAutopilotExport = async (params: InputType): Promise<void> => {
  const days = params.days ?? 30;
  const result = await fetch(`/_api/admin/autopilot/export?days=${days}`, { method: "GET" });
  if (!result.ok) throw new Error("Could not export the autopilot figures");
  const blob = await result.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `autopilot-${days}-days.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};