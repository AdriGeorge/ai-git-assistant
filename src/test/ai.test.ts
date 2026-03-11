import test from "node:test";
import assert from "node:assert/strict";
import { parseCommitResult, sanitizeDiff } from "../ai";

test("sanitizeDiff rejects empty input", () => {
  assert.throws(() => sanitizeDiff("   "), /Select a git diff/);
});

test("sanitizeDiff trims very long input", () => {
  const diff = "a".repeat(20000);
  assert.equal(sanitizeDiff(diff).length, 16000);
});

test("parseCommitResult accepts valid structured JSON", () => {
  const raw = JSON.stringify({
    primary: "feat(prompt): add structured response rules",
    alternatives: [
      "refactor: tighten prompt formatting rules",
      "fix: return valid commit message JSON",
      "chore: improve commit generation prompts"
    ],
    reasoning: "The diff adds new generation behavior, so feat best matches the change."
  });

  const result = parseCommitResult(raw, "diff --git a b");
  assert.equal(result.primary, "feat(prompt): add structured response rules");
  assert.equal(result.alternatives.length, 3);
});

test("parseCommitResult falls back for malformed JSON", () => {
  const result = parseCommitResult("not-json", "docs update readme");
  assert.match(result.primary, /^(docs|chore): /);
});
