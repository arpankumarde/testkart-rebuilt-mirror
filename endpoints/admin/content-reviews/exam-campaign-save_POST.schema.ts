import { z } from "zod";
import superjson from "superjson";

const limits = {
  totalSlots: z.number().int().min(1).max(100),
  amount: z.number().positive().max(10000),
  perTeacher: z.number().int().min(1).max(100),
};

const id = z.number().int().positive();

export const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    ...limits,
    examId: id,
    examNewsPostId: id.nullable().optional(),
    days: z.number().int().min(1).max(90),
    minTests: z.number().int().min(1).max(1000),
    minQuestions: z.number().int().min(1).max(100000),
  }),
  z.object({ action: z.literal("edit"), ...limits, id, endsAt: z.date() }),
  z.object({ action: z.literal("end"), id }),
]);

export type InputType = z.infer<typeof schema>;

export type OutputType = { success: true; message: string };

export const postAdminExamCampaignSave = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/content-reviews/exam-campaign-save`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};