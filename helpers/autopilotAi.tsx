import { flootAi, FlootAiOutOfCreditsError } from "@floot/ai";
import { getAutopilotSettings, type AutopilotAiProvider } from "./getAutopilotSettings";

/**
 * The one door to AI for the revenue autopilot (copy drafts, matching a
 * free-text exam name to the catalogue). The admin picks the provider on the
 * Autopilot page: our DeepSeek key (default) or Floot AI, billed to Floot
 * credits. This is the only place in the project that may call Floot AI; the
 * teacher and admin AI features stay on DeepSeek. Server-only.
 */

export const AUTOPILOT_AI_MODELS = {
  deepseek: "deepseek-chat",
  floot: "gpt-6-luna",
} as const satisfies Record<AutopilotAiProvider, string>;

type ResponsesOutput = {
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  flootCredits?: { consumed?: number };
};

export type AutopilotAiErrorCode = "OUT_OF_CREDITS" | "NOT_CONFIGURED" | "DISALLOWED" | "UPSTREAM";

export class AutopilotAiError extends Error {
  constructor(
    public code: AutopilotAiErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AutopilotAiError";
  }
}

export type AutopilotAiResult = {
  text: string;
  provider: AutopilotAiProvider;
  model: string;
  ms: number;
  flootCredits: number | null;
};

async function viaDeepSeek(instructions: string, input: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new AutopilotAiError("NOT_CONFIGURED", "DEEPSEEK_API_KEY is not set");
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: AUTOPILOT_AI_MODELS.deepseek,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: input },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    throw new AutopilotAiError("UPSTREAM", `DeepSeek answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function viaFloot(instructions: string, input: string, maxTokens: number): Promise<{ text: string; credits: number | null }> {
  try {
    const result = (await flootAi.chat({
      model: AUTOPILOT_AI_MODELS.floot,
      instructions,
      input,
      max_output_tokens: maxTokens,
      reasoning: { effort: "none" },
    })) as unknown as ResponsesOutput;
    const text = (result.output ?? [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();
    const credits = result.flootCredits?.consumed ?? null;
    return { text, credits };
  } catch (error) {
    if (error instanceof FlootAiOutOfCreditsError) {
      throw new AutopilotAiError("OUT_OF_CREDITS", "Floot AI credits are used up");
    }
    if (error instanceof Error && error.name === "FlootAiDisallowedError") {
      throw new AutopilotAiError("DISALLOWED", "Floot AI is switched off for this project in Floot's settings");
    }
    throw new AutopilotAiError("UPSTREAM", error instanceof Error ? error.message : "Floot AI failed");
  }
}

export async function autopilotAiText(options: {
  instructions: string;
  input: string;
  maxOutputTokens?: number;
  provider?: AutopilotAiProvider;
}): Promise<AutopilotAiResult> {
  const provider = options.provider ?? (await getAutopilotSettings()).aiProvider;
  const maxTokens = options.maxOutputTokens ?? 400;
  const started = Date.now();
  if (provider === "floot") {
    const { text, credits } = await viaFloot(options.instructions, options.input, maxTokens);
    return { text, provider, model: AUTOPILOT_AI_MODELS.floot, ms: Date.now() - started, flootCredits: credits };
  }
  const text = await viaDeepSeek(options.instructions, options.input, maxTokens);
  return { text, provider, model: AUTOPILOT_AI_MODELS.deepseek, ms: Date.now() - started, flootCredits: null };
}