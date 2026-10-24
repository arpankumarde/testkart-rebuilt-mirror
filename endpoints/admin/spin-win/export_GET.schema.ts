import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const schema = z.object({
  kind: z.enum(["spins", "coupons", "redemptions"]),
  campaignId: z.coerce.number().int().positive().optional(),
  from: day.optional(),
  to: day.optional(),
});

export type InputType = z.input<typeof schema>;
export type OutputType = string;

/** Downloads the CSV in the browser. Returns the file name used. */
export async function downloadAdminSpinExport(params: InputType): Promise<string> {
  const validated = schema.parse(params);
  const search = new URLSearchParams(
    Object.entries(validated).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]]))
  );
  const result = await fetch(`/_api/admin/spin-win/export?${search.toString()}`);
  if (!result.ok) throw new Error("The export could not be created.");
  const blob = await result.blob();
  const name = `spin-win-${validated.kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
  return name;
}