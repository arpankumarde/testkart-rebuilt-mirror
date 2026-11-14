import { z } from "zod";
import superjson from "superjson";

/** Every playbook step's email versions: live, drafts and retired, with their results. */
export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type CopyFields = { subject: string; heading: string; body: string; cta: string };

export type CopyVariant = {
  key: string;
  kind: "builtin" | "custom";
  id: number | null;
  status: "live" | "draft" | "retired" | "rejected";
  source: "builtin" | "ai" | "admin";
  /** The template with its {placeholders}; for built-in versions the copy as written in code, with sample values. */
  template: CopyFields;
  /** The copy as a student would see it, with sample values. */
  preview: CopyFields;
  sends: number;
  conversions: number;
  brief: string | null;
  aiModel: string | null;
  createdAt: Date | null;
};

export type CopyStep = {
  playbookKey: string;
  playbookLabel: string;
  step: number;
  totalSteps: number;
  offer: boolean;
  delayLabel: string;
  placeholders: string[];
  variants: CopyVariant[];
};

export type OutputType = {
  steps: CopyStep[];
  examples: string[];
  maxLivePerStep: number;
  aiProvider: "deepseek" | "floot";
};

export const getAdminAutopilotCopyVariants = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/autopilot/copy-variants`, { method: "GET", ...init });
  const parsed = superjson.parse<OutputType | { error: string }>(await result.text());
  if (!result.ok || "error" in (parsed as object)) {
    throw new Error((parsed as { error?: string }).error ?? "Could not load the message versions");
  }
  return parsed as OutputType;
};
