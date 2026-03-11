import { ALLOWED_TYPES } from "./types";

export function buildPrompt(diff: string): string {
  return [
    "You are an expert software engineer that writes precise conventional commit messages.",
    "",
    "Task:",
    "Read the provided git diff and generate commit messages.",
    "",
    "Rules:",
    "- Return valid JSON only.",
    "- Do not use markdown fences.",
    "- Do not include commentary outside JSON.",
    `- Allowed types only: ${ALLOWED_TYPES.join(", ")}`,
    "- Prefer a scope only when it is clearly inferable from the diff.",
    "- Subject must be concise, specific, under 72 characters, and in imperative mood.",
    "- Do not end the subject with a period.",
    "- Focus on the most important change in the diff.",
    "- Avoid vague subjects like \"update code\" or \"fix stuff\".",
    "",
    "Return exactly this shape:",
    "{",
    '  "primary": "type(scope): subject",',
    '  "alternatives": [',
    '    "type: subject",',
    '    "type: subject",',
    '    "type: subject"',
    "  ],",
    '  "reasoning": "One short sentence explaining the chosen type and subject."',
    "}",
    "",
    "Git diff:",
    diff
  ].join("\n");
}
