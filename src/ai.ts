import OpenAI from "openai";
import { buildPrompt } from "./prompt";
import { ALLOWED_TYPES, AppError, type CommitResult, type ExtensionConfig } from "./types";

const MIN_DIFF_LENGTH = 20;
const MAX_DIFF_LENGTH = 16000;
const commitPattern = new RegExp(
  `^(${ALLOWED_TYPES.join("|")})(\\([a-z0-9-]+\\))?: [^\\n.]{1,72}$`
);

export function sanitizeDiff(diff: string): string {
  const trimmed = diff.trim();

  if (!trimmed) {
    throw new AppError("Select a git diff or stage some changes before generating.", "invalid_diff");
  }

  if (trimmed.length < MIN_DIFF_LENGTH) {
    throw new AppError(
      `The diff is too short. Provide at least ${MIN_DIFF_LENGTH} characters.`,
      "invalid_diff"
    );
  }

  return trimmed.length > MAX_DIFF_LENGTH ? trimmed.slice(0, MAX_DIFF_LENGTH) : trimmed;
}

function normalizeJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }

  return raw.trim();
}

function isValidMessage(value: unknown): value is string {
  return typeof value === "string" && commitPattern.test(value.trim());
}

function fallbackFromDiff(diff: string): CommitResult {
  const lower = diff.toLowerCase();

  let primary = "chore: update staged changes";
  if (lower.includes("fix") || lower.includes("bug") || lower.includes("error")) {
    primary = "fix: resolve staged change behavior";
  } else if (lower.includes("test") || lower.includes("spec")) {
    primary = "test: add coverage for staged changes";
  } else if (lower.includes("readme") || lower.includes("docs")) {
    primary = "docs: document staged workflow changes";
  } else if (lower.includes("refactor")) {
    primary = "refactor: simplify staged change handling";
  } else if (lower.includes("feat") || lower.includes("add") || lower.includes("new")) {
    primary = "feat: add staged diff generation flow";
  }

  return {
    primary,
    alternatives: [
      "feat: add AI commit message generation",
      "refactor: improve commit message generation flow",
      "chore: refine commit message suggestions"
    ],
    reasoning:
      "A safe fallback was returned because the AI response could not be parsed into the required JSON shape."
  };
}

export function parseCommitResult(raw: string, diff: string): CommitResult {
  try {
    const parsed = JSON.parse(normalizeJson(raw)) as Partial<CommitResult>;

    if (
      isValidMessage(parsed.primary) &&
      Array.isArray(parsed.alternatives) &&
      parsed.alternatives.length === 3 &&
      parsed.alternatives.every(isValidMessage) &&
      typeof parsed.reasoning === "string" &&
      parsed.reasoning.trim().length > 0
    ) {
      return {
        primary: parsed.primary.trim(),
        alternatives: [
          parsed.alternatives[0].trim(),
          parsed.alternatives[1].trim(),
          parsed.alternatives[2].trim()
        ],
        reasoning: parsed.reasoning.trim()
      };
    }
  } catch {
    // Fall back to a safe result below.
  }

  return fallbackFromDiff(diff);
}

export async function generateCommitMessages(
  diff: string,
  config: ExtensionConfig
): Promise<CommitResult> {
  if (!config.apiKey.trim()) {
    throw new AppError(
      "Set aiCommitMessageGenerator.apiKey in VS Code settings before generating messages.",
      "missing_api_key"
    );
  }

  const sanitizedDiff = sanitizeDiff(diff);
  const client = new OpenAI({ apiKey: config.apiKey });

  try {
    const response = await client.responses.create({
      model: config.model || "gpt-5-mini",
      input: buildPrompt(sanitizedDiff)
    });

    return parseCommitResult(response.output_text, sanitizedDiff);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The AI request failed.";
    throw new AppError(`AI request failed: ${message}`, "ai_request_failed");
  }
}
