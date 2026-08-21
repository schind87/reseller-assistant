import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type AiTask = "identify" | "draft";

/** True when either OpenRouter or direct OpenAI is configured. */
export function hasAiProvider(): boolean {
  return Boolean(
    process.env.OPENROUTER_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );
}

export function missingAiProviderMessage(): string {
  return "AI isn’t available right now.";
}

function appReferer(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://reseller-assistant.vercel.app"
  );
}

/**
 * Prefer OpenRouter (one key, many models). Fall back to direct OpenAI.
 * Override models with OPENROUTER_IDENTIFY_MODEL / OPENROUTER_DRAFT_MODEL
 * (or OPENAI_IDENTIFY_MODEL / OPENAI_DRAFT_MODEL when using OpenAI directly).
 */
export function getAiModel(task: AiTask): LanguageModel {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    // OpenRouter is Chat Completions–compatible; do not use the Responses API.
    const openrouter = createOpenAI({
      apiKey: openRouterKey,
      baseURL: "https://openrouter.ai/api/v1",
      headers: {
        "HTTP-Referer": appReferer(),
        "X-Title": "Reseller Assistant",
      },
    });

    const identifyModel =
      process.env.OPENROUTER_IDENTIFY_MODEL?.trim() ||
      "google/gemini-2.5-pro";
    const draftModel =
      process.env.OPENROUTER_DRAFT_MODEL?.trim() || "openai/gpt-4o";

    switch (task) {
      case "identify":
        return openrouter.chat(identifyModel);
      case "draft":
        return openrouter.chat(draftModel);
      default: {
        const _exhaustive: never = task;
        return _exhaustive;
      }
    }
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openAiKey) {
    throw new Error(missingAiProviderMessage());
  }

  const openai = createOpenAI({ apiKey: openAiKey });
  const identifyModel =
    process.env.OPENAI_IDENTIFY_MODEL?.trim() || "gpt-4o";
  const draftModel = process.env.OPENAI_DRAFT_MODEL?.trim() || "gpt-4o";

  switch (task) {
    case "identify":
      return openai.chat(identifyModel);
    case "draft":
      return openai.chat(draftModel);
    default: {
      const _exhaustive: never = task;
      return _exhaustive;
    }
  }
}
